import { auth } from "@/firebase";

const WS_URL = import.meta.env.VITE_WS_URL || "http://localhost:5001";

export async function resetChatSession(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  await fetch(`${WS_URL}/api/chat/reset`, {
    method: "POST",
    headers: { "X-User-ID": user.uid },
  });
}


