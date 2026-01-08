// Todo List Application
// This is a template frontend - backend integration needs to be implemented

class TodoApp {
    constructor() {
        this.todos = [];
        this.currentFilter = 'all';
        this.editingId = null;
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadTodos();
    }

    initializeElements() {
        this.todoForm = document.getElementById('todo-form');
        this.todoInput = document.getElementById('todo-input');
        this.todoList = document.getElementById('todo-list');
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.todoCount = document.getElementById('todo-count');
        this.emptyState = document.getElementById('empty-state');
    }

    attachEventListeners() {
        this.todoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTodo();
        });

        this.filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    addTodo() {
        const text = this.todoInput.value.trim();
        if (!text) return;

        const todo = {
            id: this.generateId(),
            text: text,
            completed: false,
            createdAt: new Date().toISOString()
        };

        // TODO: Save to backend via API
        // await fetch('/api/todos', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(todo)
        // });

        this.todos.push(todo);
        this.todoInput.value = '';
        this.renderTodos();
    }

    deleteTodo(id) {
        // TODO: Delete from backend via API
        // await fetch(`/api/todos/${id}`, { method: 'DELETE' });

        this.todos = this.todos.filter(todo => todo.id !== id);
        this.renderTodos();
    }

    toggleComplete(id) {
        const todo = this.todos.find(t => t.id === id);
        if (!todo) return;

        todo.completed = !todo.completed;

        // TODO: Update backend via API
        // await fetch(`/api/todos/${id}`, {
        //     method: 'PATCH',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ completed: todo.completed })
        // });

        this.renderTodos();
    }

    startEdit(id) {
        this.editingId = id;
        this.renderTodos();
    }

    saveEdit(id, newText) {
        const todo = this.todos.find(t => t.id === id);
        if (!todo || !newText.trim()) {
            this.editingId = null;
            this.renderTodos();
            return;
        }

        todo.text = newText.trim();

        // TODO: Update backend via API
        // await fetch(`/api/todos/${id}`, {
        //     method: 'PATCH',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ text: todo.text })
        // });

        this.editingId = null;
        this.renderTodos();
    }

    setFilter(filter) {
        this.currentFilter = filter;
        
        this.filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        this.renderTodos();
    }

    getFilteredTodos() {
        switch (this.currentFilter) {
            case 'active':
                return this.todos.filter(todo => !todo.completed);
            case 'completed':
                return this.todos.filter(todo => todo.completed);
            default:
                return this.todos;
        }
    }

    renderTodos() {
        const filteredTodos = this.getFilteredTodos();
        
        this.todoList.innerHTML = '';
        
        if (filteredTodos.length === 0) {
            this.emptyState.classList.add('show');
        } else {
            this.emptyState.classList.remove('show');
        }

        filteredTodos.forEach(todo => {
            const li = document.createElement('li');
            li.className = `todo-item ${todo.completed ? 'completed' : ''} ${this.editingId === todo.id ? 'editing' : ''}`;
            
            if (this.editingId === todo.id) {
                li.innerHTML = `
                    <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''} 
                           onchange="app.toggleComplete('${todo.id}')">
                    <input type="text" class="edit-input" value="${todo.text}" 
                           onblur="app.saveEdit('${todo.id}', this.value)"
                           onkeypress="if(event.key === 'Enter') app.saveEdit('${todo.id}', this.value); event.target.blur();"
                           autofocus>
                    <div class="todo-actions">
                        <button class="todo-btn delete-btn" onclick="app.deleteTodo('${todo.id}')">Delete</button>
                    </div>
                `;
            } else {
                li.innerHTML = `
                    <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''} 
                           onchange="app.toggleComplete('${todo.id}')">
                    <span class="todo-text">${this.escapeHtml(todo.text)}</span>
                    <div class="todo-actions">
                        <button class="todo-btn edit-btn" onclick="app.startEdit('${todo.id}')">Edit</button>
                        <button class="todo-btn delete-btn" onclick="app.deleteTodo('${todo.id}')">Delete</button>
                    </div>
                `;
            }
            
            this.todoList.appendChild(li);
        });

        this.updateStats();
    }

    updateStats() {
        const total = this.todos.length;
        const active = this.todos.filter(t => !t.completed).length;
        const completed = this.todos.filter(t => t.completed).length;
        
        let countText = '';
        switch (this.currentFilter) {
            case 'active':
                countText = `${active} active task${active !== 1 ? 's' : ''}`;
                break;
            case 'completed':
                countText = `${completed} completed task${completed !== 1 ? 's' : ''}`;
                break;
            default:
                countText = `${total} task${total !== 1 ? 's' : ''} (${active} active, ${completed} completed)`;
        }
        
        this.todoCount.textContent = countText;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async loadTodos() {
        // TODO: Load todos from backend via API
        // try {
        //     const response = await fetch('/api/todos');
        //     this.todos = await response.json();
        //     this.renderTodos();
        // } catch (error) {
        //     console.error('Failed to load todos:', error);
        // }

        // For now, use sample data or empty array
        this.todos = [];
        this.renderTodos();
    }
}

// Initialize the app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new TodoApp();
});

