export function sanitizeNameForEmoji(name: string) {
    return name.replaceAll(' ', '_').replace(/[^a-zA-Z0-9_]/g, '');
}
