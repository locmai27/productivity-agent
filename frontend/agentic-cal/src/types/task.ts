import type { Tag } from "./tag"
import type { Reminder } from "./reminder"

export type Task = {
    id: string,
    title: string,
    description: string,
    completed: boolean,
    tags: Tag[],
    date: string,
    reminders: Reminder[]
}

