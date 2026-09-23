import type { AnyComponent, APIUnfurledMediaItem, ButtonComponent, ChannelSelectMenuComponent, MentionableSelectMenuComponent, RoleSelectMenuComponent, StringSelectMenuComponent, TopLevelComponent, UnfurledMediaItem, UserSelectMenuComponent } from 'discord.js';
import { ComponentType } from 'discord.js';

type AllowedComponents =
    | AnyComponent
    | TopLevelComponent
    | ButtonComponent
    | StringSelectMenuComponent
    | UserSelectMenuComponent
    | RoleSelectMenuComponent
    | MentionableSelectMenuComponent
    | ChannelSelectMenuComponent

export function extractAttachmentIds(component: AllowedComponents) {
    const ids = new Set<string>();

    function addMedia(media: UnfurledMediaItem | APIUnfurledMediaItem) {
        if ('data' in media) {
            addMedia(media.data);
        }
        else if (media.attachment_id) {
            ids.add(media.attachment_id);
        }
    };

    // eslint-disable-next-line no-shadow
    function visit(component: AllowedComponents) {
        switch (component.type) {
        case ComponentType.MediaGallery:
            for (const item of component.items) {
                addMedia(item.media);
            }
            break;
        case ComponentType.Thumbnail:
            addMedia(component.media);
            break;
        case ComponentType.File:
            addMedia(component.file);
            break;
        case ComponentType.Container:
            for (const child of component.components) {
                visit(child);
            }
            return;
        case ComponentType.Section:
            visit(component.accessory);
            for (const child of component.components) {
                visit(child);
            }
            break;
        case ComponentType.ActionRow:
            for (const child of component.components) {
                visit(child);
            }
            break;
        case ComponentType.Label:
            visit(component.component);
            break;
        // Leaf components with no possible attachment references.
        case ComponentType.TextDisplay:
        case ComponentType.TextInput:
        case ComponentType.Separator:
        case ComponentType.Button:
        case ComponentType.StringSelect:
        case ComponentType.UserSelect:
        case ComponentType.RoleSelect:
        case ComponentType.MentionableSelect:
        case ComponentType.ChannelSelect:
        case ComponentType.FileUpload:
        case ComponentType.RadioGroup:
        case ComponentType.CheckboxGroup:
        case ComponentType.Checkbox:
            break;
        default: {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const exhaustiveCheck: never = component;
            throw new Error('Unhandled ComponentType');
        }
        }
    }

    visit(component);

    return [...ids];
}

