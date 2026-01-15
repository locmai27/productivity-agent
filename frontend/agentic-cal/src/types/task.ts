import type { Tag } from "./tag"

export type Task = {
    id: string,
    title: string,
    description: string,
    completed: boolean,
    tags: Tag[],
    date: string
}

