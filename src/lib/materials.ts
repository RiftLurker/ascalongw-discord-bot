import materials from '../../assets/materials.json' with { type: 'json' };

export interface Material {
    id: number;
    name: string;
    per?: 10;
    aliases?: string[];
    type: 'rare' | 'common';
    order: number;
}

const idRegistry = new Map<number, Material>();
const nameRegistry = new Map<string, Material>();
const traderRegistry = new Map<Material['type'], Material[]>();

materials.forEach(material => {
    idRegistry.set(material.id, material);
    nameRegistry.set(material.name.toLowerCase(), material);
    material.aliases?.forEach(alias => nameRegistry.set(alias.toLowerCase(), material));
    traderRegistry.set(material.type, [...(traderRegistry.get(material.type) ?? []), material]);
});

for (const [type, mats] of traderRegistry.entries()) {
    traderRegistry.set(type, mats.sort((a, b) => a.order - b.order));
}

export function getMaterial(identifier: string | number | ((material: Material) => boolean)): Material | null {
    if (typeof identifier === 'string') {
        return nameRegistry.get(identifier.toLowerCase())!;
    }
    else if (typeof identifier === 'number') {
        return idRegistry.get(identifier)!;
    }
    else if (typeof identifier === 'function') {
        return materials.find(identifier)!;
    }
    return null;
}

export function getMaterials(type: Material['type']) {
    return traderRegistry.get(type)!;
}
