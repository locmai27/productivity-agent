import type { Task } from "@/types/task";
import type { Tag } from "@/types/tag";
import { auth } from "@/firebase";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }
  return {
    "Content-Type": "application/json",
    "X-User-ID": user.uid,
  };
}

export async function fetchTasks(): Promise<Task[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/tasks`, {
    headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch tasks: ${response.statusText}`);
  }
  return response.json();
}

export async function createTask(task: Omit<Task, "id">): Promise<Task> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/tasks`, {
    method: "POST",
    headers,
    body: JSON.stringify(task),
  });
  if (!response.ok) {
    throw new Error(`Failed to create task: ${response.statusText}`);
  }
  return response.json();
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error(`Failed to update task: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteTask(taskId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
    method: "DELETE",
    headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to delete task: ${response.statusText}`);
  }
}

export async function toggleTask(taskId: string): Promise<Task> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/toggle`, {
    method: "POST",
    headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to toggle task: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchTags(): Promise<Tag[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/tags`, {
    headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch tags: ${response.statusText}`);
  }
  return response.json();
}

export async function createTag(tag: Omit<Tag, "id">): Promise<Tag> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/tags`, {
    method: "POST",
    headers,
    body: JSON.stringify(tag),
  });
  if (!response.ok) {
    throw new Error(`Failed to create tag: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteTag(tagId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/tags/${tagId}`, {
    method: "DELETE",
    headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to delete tag: ${response.statusText}`);
  }
}

