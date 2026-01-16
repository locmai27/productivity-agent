"""
WebSocket server for real-time chatbot communication with Backboard integration.
"""

import os
import asyncio
from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, disconnect
from flask_cors import CORS
from database_client import SQLiteDatabaseClient, create_database_client
from backboard_client import BackboardWrapper
from workflow import TodoAgentWorkflow
from backboard_api_client import BackboardAPIClient
import threading
import tempfile
from werkzeug.utils import secure_filename
import mimetypes

from PIL import Image

# Eventlet is required for stable websocket support
import eventlet
eventlet.monkey_patch()
from typing import Optional

# Optional OCR deps; fall back gracefully if not installed
try:
    import pytesseract
except Exception:  # pragma: no cover
    pytesseract = None

try:
    from pdf2image import convert_from_path
except Exception:  # pragma: no cover
    convert_from_path = None

app = Flask(__name__)
CORS(app, origins="*")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

# Backboard API key
BACKBOARD_API_KEY = os.getenv("BACKBOARD_API_KEY")
BACKBOARD_BASE_URL = os.getenv("BACKBOARD_BASE_URL", "https://app.backboard.io/api")
BACKBOARD_LLM_PROVIDER = os.getenv("BACKBOARD_LLM_PROVIDER") or None
BACKBOARD_MODEL_NAME = os.getenv("BACKBOARD_MODEL_NAME") or None

if not BACKBOARD_API_KEY:
    raise RuntimeError(
        "BACKBOARD_API_KEY is not set. "
        "Set it in your environment before starting websocket_server.py."
    )

# Database path (absolute, so api + websocket share the same DB)
_default_db_path = os.path.join(os.path.dirname(__file__), "productivity_agent.db")
db_path = os.getenv("DB_PATH", _default_db_path)

# Thread-local storage for database connections and workflows
_local = threading.local()

def get_db():
    """Get database client for current thread."""
    if not hasattr(_local, 'db_client'):
        _local.db_client = create_database_client(connection_string=db_path, client_type="sqlite")
        _local.db_client.connect()
    return _local.db_client

def get_backboard_client():
    """Get Backboard client instance."""
    if not hasattr(_local, 'backboard_client'):
        _local.backboard_client = BackboardAPIClient(api_key=BACKBOARD_API_KEY, base_url=BACKBOARD_BASE_URL)
    return _local.backboard_client

def get_workflow(user_id: str):
    """Get or create workflow for user."""
    if not hasattr(_local, 'workflow') or getattr(_local, 'user_id', None) != user_id:
        db = get_db()
        backboard_client = get_backboard_client()
        backboard = BackboardWrapper(client=backboard_client, store=db)
        _local.workflow = TodoAgentWorkflow(
            backboard=backboard,
            db_client=db,
            llm_provider=BACKBOARD_LLM_PROVIDER,
            model_name=BACKBOARD_MODEL_NAME,
        )
        _local.user_id = user_id
    return _local.workflow


@app.post("/api/chat/upload")
def upload_chat_file():
    """
    Upload a file for the current user's Backboard session thread.

    Expects:
      - Header: X-User-ID
      - multipart/form-data with field 'file' (or 'files')
    """
    user_id = request.headers.get("X-User-ID") or request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "Missing X-User-ID"}), 401

    f = request.files.get("file")
    if f is None:
        # allow 'files' too (matching Backboard naming)
        f = request.files.get("files")
    if f is None:
        return jsonify({"error": "No file uploaded"}), 400

    filename = secure_filename(f.filename or "upload")
    if not filename:
        filename = "upload"

    tmp_dir = os.path.join(tempfile.gettempdir(), "productivity-agent-uploads", user_id)
    os.makedirs(tmp_dir, exist_ok=True)
    file_path = os.path.join(tmp_dir, filename)
    f.save(file_path)

    # Backboard allowed MIME types (from your error message + common office types)
    allowed_mimes = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # docx
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # pptx
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # xlsx
        "application/vnd.ms-powerpoint",  # ppt
        "application/vnd.ms-excel",  # xls
        "application/xml",
        "text/x-markdown",
        "text/java",
        "application/jsonlines",
    }

    mime, _enc = mimetypes.guess_type(filename)
    mime = mime or (f.mimetype if hasattr(f, "mimetype") else None) or "application/octet-stream"

    converted_path = None
    converted_reason = None

    def ocr_to_markdown(path: str, mime_type: str) -> Optional[str]:
        """
        OCR an image or PDF into markdown to avoid Backboard chunking errors.
        Returns path to .md file, or None if OCR isn't possible.
        """
        if pytesseract is None:
            raise RuntimeError("pytesseract is not installed. Install pytesseract + tesseract-ocr.")
        images = []
        if mime_type.startswith("image/") or path.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            try:
                images = [Image.open(path).convert("RGB")]
            except Exception:
                return None
        elif path.lower().endswith(".pdf"):
            if convert_from_path is None:
                raise RuntimeError("pdf2image is not installed. Install pdf2image + poppler-utils.")
            try:
                images = convert_from_path(path)
            except Exception:
                return None
        else:
            return None

        texts = []
        for img in images:
            try:
                texts.append(pytesseract.image_to_string(img))
            except Exception:
                continue
        merged = "\n\n".join([t for t in texts if t and t.strip()]).strip()
        if not merged:
            return None
        md_path = os.path.splitext(path)[0] + ".md"
        with open(md_path, "w", encoding="utf-8") as wf:
            wf.write(merged)
        return md_path

    # Auto-convert common unsupported types
    if mime not in allowed_mimes:
        # Images -> PDF (Backboard accepts PDF; it may OCR/parse inside)
        if mime.startswith("image/") or filename.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            try:
                img = Image.open(file_path).convert("RGB")
                converted_path = os.path.splitext(file_path)[0] + ".pdf"
                img.save(converted_path, "PDF")
                converted_reason = f"Converted image ({mime}) to PDF for Backboard compatibility."
            except Exception as e:
                return jsonify({"ok": False, "error": f"Image->PDF conversion failed: {e}"}), 400
        # Plain text -> Markdown
        elif mime == "text/plain" or filename.lower().endswith(".txt"):
            try:
                with open(file_path, "rb") as rf:
                    raw = rf.read()
                text = raw.decode("utf-8", errors="replace")
                converted_path = os.path.splitext(file_path)[0] + ".md"
                with open(converted_path, "w", encoding="utf-8") as wf:
                    wf.write(text)
                converted_reason = "Converted text/plain to Markdown for Backboard compatibility."
            except Exception as e:
                return jsonify({"ok": False, "error": f"TXT->MD conversion failed: {e}"}), 400
        else:
            return jsonify(
                {
                    "ok": False,
                    "error": f"Invalid file type {mime}. Please upload PDF/DOCX/PPTX/XLSX/MD/XML/JAVA/JSONL or an image/text file that can be auto-converted.",
                }
            ), 400

    def do_upload():
        workflow = get_workflow(user_id)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(workflow.backboard.upload_session_doc(user_id, file_path))
        finally:
            loop.close()

    # Return thread/doc info to help UI debug indexing
    def do_list_docs():
        workflow = get_workflow(user_id)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            thread_id = loop.run_until_complete(workflow.backboard.get_thread_id(user_id))
            docs = loop.run_until_complete(workflow.backboard.client.list_thread_documents(thread_id))
            return thread_id, docs or []
        finally:
            loop.close()

    try:
        upload_path = converted_path or file_path
        if converted_path:
            filename_to_report = os.path.basename(upload_path)
        else:
            filename_to_report = filename

        # If the upload is an image or PDF, force OCR and attach the text directly.
        if mime.startswith("image/") or upload_path.lower().endswith(".pdf"):
            ocr_md_path = ocr_to_markdown(upload_path, mime)
            if not ocr_md_path:
                return jsonify({"ok": False, "error": "OCR produced no text for this file."}), 400

            def do_attach_text():
                workflow = get_workflow(user_id)
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    with open(ocr_md_path, "r", encoding="utf-8") as rf:
                        ocr_text = rf.read().strip()
                    return loop.run_until_complete(
                        workflow.backboard.add_thread_message(
                            user_id,
                            content=f"OCR text from uploaded document:\n\n{ocr_text}",
                            send_to_llm=False,
                            memory="Auto",
                        )
                    )
                finally:
                    loop.close()

            _attach = do_attach_text()
            thread_id, docs = do_list_docs()
            return jsonify(
                {
                    "ok": True,
                    "filename": filename_to_report,
                    "converted": bool(converted_path),
                    "note": "Uploaded file OCR’d locally and attached as text (skipped Backboard document upload).",
                    "ocr_attached": True,
                    "result": _attach,
                    "thread_id": thread_id,
                    "documents": docs,
                }
            ), 200

        result = do_upload() if upload_path == file_path else None
        if upload_path != file_path:
            # re-run upload using converted file
            def do_upload_converted():
                workflow = get_workflow(user_id)
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    return loop.run_until_complete(workflow.backboard.upload_session_doc(user_id, upload_path))
                finally:
                    loop.close()
            result = do_upload_converted()

        thread_id, docs = do_list_docs()
        # Log doc status for debugging
        try:
            doc_debug = [
                {
                    "document_id": d.get("document_id"),
                    "filename": d.get("filename"),
                    "status": d.get("status"),
                    "status_message": d.get("status_message"),
                    "summary": d.get("summary"),
                }
                for d in (docs or [])
            ]
            print(f"[upload] thread_id={thread_id} docs={doc_debug}")
        except Exception:
            pass

        # If Backboard failed to process the document, try OCR fallback (image/pdf -> markdown)
        error_docs = [
            d for d in (docs or [])
            if str(d.get("status", "")).lower() == "error"
        ]
        ocr_note = None
        if error_docs:
            ocr_md_path = ocr_to_markdown(upload_path, mime)
            if ocr_md_path:
                try:
                    def do_upload_ocr():
                        workflow = get_workflow(user_id)
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                        try:
                            return loop.run_until_complete(workflow.backboard.upload_session_doc(user_id, ocr_md_path))
                        finally:
                            loop.close()
                    _ocr_result = do_upload_ocr()
                    thread_id, docs = do_list_docs()
                    ocr_note = "Backboard failed to parse the document. Uploaded OCR text (.md) instead."
                except Exception as e:
                    # If Backboard still can't parse documents, attach OCR text as a thread message.
                    try:
                        with open(ocr_md_path, "r", encoding="utf-8") as rf:
                            ocr_text = rf.read().strip()
                        if ocr_text:
                            def do_attach_text():
                                workflow = get_workflow(user_id)
                                loop = asyncio.new_event_loop()
                                asyncio.set_event_loop(loop)
                                try:
                                    return loop.run_until_complete(
                                        workflow.backboard.add_thread_message(
                                            user_id,
                                            content=f"OCR text from uploaded document:\n\n{ocr_text}",
                                            send_to_llm=False,
                                            memory="Auto",
                                        )
                                    )
                                finally:
                                    loop.close()
                            _attach = do_attach_text()
                            ocr_note = "Backboard couldn't parse the file. Attached OCR text to the thread instead."
                        else:
                            ocr_note = f"OCR fallback failed: {e}"
                    except Exception:
                        ocr_note = f"OCR fallback failed: {e}"

        return jsonify(
            {
                "ok": True,
                "filename": filename_to_report,
                "converted": bool(converted_path),
                "note": converted_reason or ocr_note,
                "result": result,
                "thread_id": thread_id,
                "documents": docs,
            }
        ), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e), "filename": filename}), 500


@app.get("/api/chat/history")
def chat_history():
    """
    Return Backboard thread messages for this user (so UI can render conversation history).
    """
    user_id = request.headers.get("X-User-ID") or request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "Missing X-User-ID"}), 401

    def do_fetch():
        workflow = get_workflow(user_id)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(workflow.backboard.get_thread(user_id))
        finally:
            loop.close()

    try:
        thread = do_fetch()
        return jsonify({"ok": True, "thread": thread}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.post("/api/chat/reset")
def chat_reset():
    """
    Reset chat for a user:
      - delete Backboard thread
      - clear stored thread_id in DB
    """
    user_id = request.headers.get("X-User-ID") or request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "Missing X-User-ID"}), 401

    def do_reset():
        workflow = get_workflow(user_id)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(workflow.backboard.end_session(user_id, delete_thread=True))
        finally:
            loop.close()

    try:
        do_reset()
        return jsonify({"ok": True}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.get("/api/chat/documents")
def chat_documents():
    """
    Return the current user's thread documents (including status) so the UI can
    show indexing progress / block sending until ready.
    """
    user_id = request.headers.get("X-User-ID") or request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "Missing X-User-ID"}), 401

    def do_fetch():
        workflow = get_workflow(user_id)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            thread_id = loop.run_until_complete(workflow.backboard.get_thread_id(user_id))
            docs = loop.run_until_complete(workflow.backboard.client.list_thread_documents(thread_id))
            return docs or []
        finally:
            loop.close()

    try:
        docs = do_fetch()
        thread_id = None
        try:
            workflow = get_workflow(user_id)
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            thread_id = loop.run_until_complete(workflow.backboard.get_thread_id(user_id))
            loop.close()
        except Exception:
            pass
        try:
            doc_debug = [
                {
                    "document_id": d.get("document_id"),
                    "filename": d.get("filename"),
                    "status": d.get("status"),
                    "status_message": d.get("status_message"),
                    "summary": d.get("summary"),
                }
                for d in (docs or [])
            ]
            print(f"[docs] thread_id={thread_id} docs={doc_debug}")
        except Exception:
            pass
        return jsonify({"ok": True, "thread_id": thread_id, "documents": docs}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@socketio.on('connect')
def handle_connect(auth=None):
    """Handle client connection."""
    # Get user_id from auth or query string
    if auth:
        user_id = auth.get('user_id')
    else:
        user_id = request.args.get('user_id')
    
    if not user_id:
        print("Connection rejected: no user_id")
        disconnect()
        return False
    
    print(f"Client connected: {user_id}")
    emit('connected', {'status': 'connected', 'user_id': user_id})
    return True

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection."""
    print("Client disconnected")
    # Clean up thread-local resources
    if hasattr(_local, 'db_client'):
        _local.db_client.disconnect()
        if hasattr(_local, 'db_client'):
            delattr(_local, 'db_client')
    if hasattr(_local, 'workflow'):
        delattr(_local, 'workflow')

@socketio.on('message')
def handle_message(data):
    """Handle incoming chat message."""
    user_id = data.get('user_id')
    message = data.get('message', '').strip()
    remember = data.get('remember', False)
    
    if not user_id or not message:
        emit('error', {'message': 'Missing user_id or message'})
        return
    
    if not message:
        emit('error', {'message': 'Message cannot be empty'})
        return
    
    print(f"Received message from {user_id}: {message}")

    # IMPORTANT: do NOT echo the user message back to the client.
    # The frontend already appends the user's message locally; echoing causes duplicates.
    sid = request.sid
    
    # Process message asynchronously
    def process_and_respond():
        try:
            workflow = get_workflow(user_id)
            
            # Run async workflow in event loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                # If documents are still indexing, don't send to LLM yet.
                # This prevents the model from claiming it can't see the uploaded file.
                thread_id = loop.run_until_complete(workflow.backboard.get_thread_id(user_id))
                docs = loop.run_until_complete(workflow.backboard.client.list_thread_documents(thread_id))
                pending = [d for d in (docs or []) if str(d.get("status", "")).lower() in {"pending", "processing", "indexing"}]
                if pending:
                    socketio.emit(
                        'message',
                        {
                            'role': 'assistant',
                            'content': "Your uploaded document is still indexing. Please wait ~10–30 seconds and try again.",
                            'user_id': user_id
                        },
                        to=sid,
                    )
                    return

                # If user asks about an uploaded file but no docs are attached, check for OCR text in thread history.
                if not docs:
                    msg_lower = message.lower()
                    if any(term in msg_lower for term in ["upload", "uploaded", "file", "document", "syllabus", "deadline"]):
                        try:
                            thread = loop.run_until_complete(workflow.backboard.get_thread(user_id))
                            msgs = thread.get("messages", []) if isinstance(thread, dict) else []
                            has_ocr = any(
                                isinstance(m, dict)
                                and isinstance(m.get("content"), str)
                                and m["content"].startswith("OCR text from uploaded document:")
                                for m in msgs
                            )
                        except Exception:
                            has_ocr = False

                        if not has_ocr:
                            socketio.emit(
                                'message',
                                {
                                    'role': 'assistant',
                                    'content': "I don’t see any indexed documents or OCR text in your current chat thread. Please re-upload the file, then try again.",
                                    'user_id': user_id
                                },
                                to=sid,
                            )
                            return

                def progress_emit(text: str) -> None:
                    if text == "__CALENDAR_UPDATED__":
                        socketio.emit(
                            "calendar_updated",
                            {"user_id": user_id},
                            to=sid,
                        )
                        return
                    socketio.emit(
                        'message',
                        {
                            'role': 'assistant',
                            'content': text,
                            'user_id': user_id
                        },
                        to=sid,
                    )

                response = loop.run_until_complete(
                    workflow.process_message(
                        user_id,
                        message,
                        remember=remember,
                        progress_cb=progress_emit,
                    )
                )
                
                # Emit assistant response
                socketio.emit(
                    'message',
                    {
                        'role': 'assistant',
                        'content': response,
                        'user_id': user_id
                    },
                    to=sid,
                )
            finally:
                loop.close()
                
        except Exception as e:
            print(f"Error processing message: {e}")
            import traceback
            traceback.print_exc()
            socketio.emit('error', {
                'message': f'Error processing message: {str(e)}',
                'user_id': user_id
            }, to=sid)
    
    # Run in background thread
    thread = threading.Thread(target=process_and_respond)
    thread.daemon = True
    thread.start()

@socketio.on('ping')
def handle_ping():
    """Handle ping for connection keepalive."""
    emit('pong')

if __name__ == '__main__':
    port = int(os.getenv("WS_PORT", 5001))
    print(f"Starting WebSocket server on port {port}")
    print("Backboard configured via BACKBOARD_API_KEY/BACKBOARD_BASE_URL env vars.")
    socketio.run(app, host='0.0.0.0', port=port, debug=True, allow_unsafe_werkzeug=True)

