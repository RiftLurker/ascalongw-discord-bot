import materials from '../../assets/materials.json';

export interface Material {
    id: number;
    name: string;
    icon: string;
    per?: 10;
    aliases?: string[];
    type: 'rare' | 'common';
    emoji: string;
    order: number;
}

const idRegistry: Map<number, Material> = new Map();
const nameRegistry: Map<string, Material> = new Map();
const traderRegistry: Map<Material['type'], Material[]> = new Map();

materials.forEach(material => {
    idRegistry.set(material.id as unknown as number, material);
    nameRegistry.set(material.name.toLowerCase(), material);
    material.aliases?.forEach(alias => nameRegistry.set(alias.toLowerCase(), material));
    traderRegistry.set(material.type, [...(traderRegistry.get(material.type) ?? []), material]);
});

for (const [type, mats] of traderRegistry.entries()) {
    traderRegistry.set(type, mats.sort((a, b) => a.order - b.order));
}

export function getMaterial(identifier: string | number | ((material: Material) => boolean)): Material | null {
    if (typeof identifier === 'string') {
        return nameRegistry.get(identifier.toLowerCase()) as Material;
    }
    else if (typeof identifier === 'number') {
        return idRegistry.get(identifier) as Material;
    }
    else if (typeof identifier === 'function') {
        return materials.find(identifier) as Material;
    }
    return null;
}

export function getMaterials(type: Material['type']) {
    return traderRegistry.get(type)!;
}