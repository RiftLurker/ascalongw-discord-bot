/**
 * paw·ned² decoder
 *
 * Decodes:
 *   pwnd0001?...>BASE64-LIKE-BODY<
 *
 * The paw·ned² body uses the normal RFC 4648 Base64 alphabet as
 * a 6-bit alphabet, but fields are not themselves necessarily
 * binary Base64 data. For example, the skill field is the
 * Guild Wars skill-template string.
 */

import { decodeTemplate, Skillbar } from './skills.ts';

const PAWNED_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const PAWNED_VALUE = new Map(
    [...PAWNED_ALPHABET].map((char, index) => [char, index]),
);

export interface PawnedHeader {
  version: number;
  encoding: 0 | 1 | 2;
  encodingName: 'undefined/ANSI' | 'windows-1252' | 'utf-8';
  comment?: string;
}

export interface PawnedFlags {
  /** Five 3-bit attribute bonuses, in primary-attribute order. */
  attributeBonuses: number[];

  /** Raw 18-bit consumable flag mask. */
  consumableMask: number;

  consumables: string[];

  /** Raw 36-bit representation, useful for debugging. */
  raw: bigint;
}

export interface SkillAttribute {
  id: number;
  points: number;
}

export interface PawnedBuild {
  template: string;
  equipment: string;
  weaponsets: [
    string,
    string,
    string,
  ];

  player: string;

  templateName: string;
  description: string;

  flags: PawnedFlags;

  skillbar: Skillbar;
}

export interface PawnedTemplate {
  header: PawnedHeader;
  builds: PawnedBuild[];
}

function pawnedValue(char: string): number {
    const value = PAWNED_VALUE.get(char);

    if (value === undefined) {
        throw new Error(`Invalid paw·ned² Base64 character: ${JSON.stringify(char)}`);
    }

    return value;
}

/**
 * Read a one-byte paw·ned² length.
 *
 * The length byte is itself represented by one Base64 alphabet character,
 * whose ordinal is the length.
 */
function readLength(body: string, offset: number): {
  length: number;
  nextOffset: number;
} {
    if (offset >= body.length) {
        throw new Error('Unexpected end of paw·ned² body while reading length');
    }

    const length = pawnedValue(body[offset]);

    return {
        length,
        nextOffset: offset + 1,
    };
}

/**
 * Read a two-byte length.
 *
 * length = firstOrdinal * 64 + secondOrdinal
 */
function readLongLength(body: string, offset: number): {
  length: number;
  nextOffset: number;
} {
    if (offset + 2 > body.length) {
        throw new Error(
            'Unexpected end of paw·ned² body while reading two-byte length',
        );
    }

    const high = pawnedValue(body[offset]);
    const low = pawnedValue(body[offset + 1]);

    return {
        length: high * 64 + low,
        nextOffset: offset + 2,
    };
}

function readField(
    body: string,
    offset: number,
): {
  value: string;
  nextOffset: number;
} {
    const { length, nextOffset } = readLength(body, offset);

    const end = nextOffset + length;

    if (end > body.length) {
        throw new Error(
            `Invalid paw·ned² field: length ${length} exceeds remaining body`,
        );
    }

    return {
        value: body.slice(nextOffset, end),
        nextOffset: end,
    };
}


function base64ToBytes(base64: string): Uint8Array {
    return Uint8Array.from(Buffer.from(base64, 'base64'));
}

function decodeText(
    value: string,
    encoding: PawnedHeader['encoding'],
): string {
    const bytes = base64ToBytes(value);

    switch (encoding) {
    case 2:
        return new TextDecoder('utf-8', {
            fatal: false,
        }).decode(bytes);

    case 1:
        return new TextDecoder('windows-1252', {
            fatal: false,
        }).decode(bytes);

    case 0:
    default:
        return new TextDecoder('windows-1252', {
            fatal: false,
        }).decode(bytes);
    }
}

function decodeHeader(input: string): {
  header: PawnedHeader;
  bodyStart: number;
} {
    if (input.length < 8) {
        throw new Error('paw·ned² template is shorter than the 8-byte header');
    }

    if (input.slice(0, 4) !== 'pwnd') {
        throw new Error(
            `Invalid paw·ned² magic: expected "pwnd", got ${JSON.stringify(
                input.slice(0, 4),
            )}`,
        );
    }

    // The documentation describes these as four integer bytes.
    //
    // Example:
    //   pwnd0001
    //
    // Therefore:
    //   byte 4 = '0'
    //   byte 5 = '0'
    //   byte 6 = '0'
    //   byte 7 = '1'
    //
    // These are ASCII digits in actual paw·ned² strings.
    const flagChars = input.slice(4, 8);

    if (!/^\d{4}$/.test(flagChars)) {
        throw new Error(
            `Invalid paw·ned² header flags: ${JSON.stringify(flagChars)}`,
        );
    }

    const version = Number(flagChars[0]);
    const unused1 = Number(flagChars[1]);
    const unused2 = Number(flagChars[2]);
    const encoding = Number(flagChars[3]);

    if (unused1 !== 0 || unused2 !== 0) {
        throw new Error(
            `Unsupported paw·ned² header: reserved bytes are ${unused1}, ${unused2}`,
        );
    }

    if (encoding !== 0 && encoding !== 1 && encoding !== 2) {
        throw new Error(`Unsupported paw·ned² character encoding: ${encoding}`);
    }

    let headerEnd = 8;
    let comment: string | undefined;

    if (input[headerEnd] === '?') {
        const commentEnd = input.indexOf('>', headerEnd);

        if (commentEnd === -1) {
            throw new Error('paw·ned² template has \'?\' but no body');
        }

        comment = input.slice(headerEnd + 1, commentEnd);

        if (comment.includes('>') || comment.includes('<')) {
            throw new Error('Invalid paw·ned² comment');
        }

        // The body begins at the '>' itself.
        headerEnd = commentEnd;
    }

    const encodingName =
    encoding === 0
        ? 'undefined/ANSI'
        : encoding === 1
            ? 'windows-1252'
            : 'utf-8';

    return {
        header: {
            version,
            encoding: encoding as 0 | 1 | 2,
            encodingName,
            ...(comment !== undefined ? { comment } : {}),
        },
        bodyStart: headerEnd,
    };
}

function extractBody(input: string, start: number): string {
    const open = input.indexOf('>', start);

    if (open === -1) {
        throw new Error('paw·ned² template has no opening \'>\'');
    }

    const close = input.indexOf('<', open + 1);

    if (close === -1) {
        throw new Error('paw·ned² template has no closing \'<\'');
    }

    // According to the format, everything before '>' and after '<' is
    // irrelevant, and whitespace inside the body is ignored.
    const body = input
        .slice(open + 1, close)
        .replace(/\s+/g, '');

    if (!body) {
        throw new Error('paw·ned² template contains an empty body');
    }

    for (const char of body) {
        if (!PAWNED_VALUE.has(char)) {
            throw new Error(
                `Invalid character ${JSON.stringify(char)} in paw·ned² body`,
            );
        }
    }

    return body;
}

const CONSUMABLE_FLAGS = [
    'buLunarFortune',
    'buCandyCorn',
    'buGoldenEgg',
    'buBirthdayCupcake',
    'buSliceOfPumpkinPie',
    'buCandyApple',
    'buWarSupplies',
    'buDrakeKabob',
    'buBowlOfSkalefinSoup',
    'buPahnaiSalad',
    'buGreenRockCandy',
    'buBlueRockCandy',
    'buRedRockCandy',
    'buEssenceOfCelerity',
    'buArmorOfSalvation',
    'buGrailOfMight',
] as const;

/**
 * Decode the paw·ned² flags field.
 *
 * Six Base64 characters = 36 bits.
 *
 * The first 18 bits contain:
 *
 *   5 x 3-bit attribute bonuses
 *   3 unused bits
 *
 * The next 18 bits contain:
 *
 *   16 consumable flags
 *   2 currently unused/reserved bits
 *
 * The documentation describes the attribute portion as little-endian
 * bytes and flags as a big-endian integer. Treating the six 6-bit values
 * as a 36-bit stream makes the bit positions explicit and avoids
 * JavaScript's 32-bit bitwise limitations.
 */
function decodeFlags(field: string): PawnedFlags {
    if (field.length > 6) {
        throw new Error(
            `Invalid paw·ned² flags field: expected at most 6 characters, got ${field.length}`,
        );
    }

    // Missing characters are effectively zero-padding.
    let raw = 0n;

    for (const char of field) {
        raw = (raw << 6n) | BigInt(pawnedValue(char));
    }

    const bitsPresent = field.length * 6;
    const shift = 36 - bitsPresent;

    // Align shorter fields to the high end of the 36-bit representation.
    raw <<= BigInt(shift);

    // Attribute bits are the first 15 bits of the 36-bit stream.
    const attributePart = Number((raw >> 21n) & 0x7fffn);

    const attributeBonuses: number[] = [];

    for (let i = 0; i < 5; i++) {
        attributeBonuses.push(
            (attributePart >> (i * 3)) & 0x7,
        );
    }

    // Flags begin at bit 18 of the 36-bit stream.
    const flagPart = Number((raw >> 3n) & 0x3ffffn);

    const consumables: string[] = [];

    for (let i = 0; i < CONSUMABLE_FLAGS.length; i++) {
    // Flag 0 is the leftmost bit of the documented 18-bit mask.
        const bit = 17 - i;

        if ((flagPart & (1 << bit)) !== 0) {
            consumables.push(CONSUMABLE_FLAGS[i]);
        }
    }

    return {
        attributeBonuses,
        consumableMask: flagPart,
        consumables,
        raw,
    };
}

function decodeBuild(
    body: string,
    offset: number,
    encoding: PawnedHeader['encoding'],
): {
  build: PawnedBuild;
  nextOffset: number;
} {
    /*
   * Field order from the format:
   *
   *   skills
   *   equipment
   *   weaponset 1
   *   weaponset 2
   *   weaponset 3
   *   flags
   *   player
   *   name/description
   */

    let result = readField(body, offset);
    const skills = result.value;
    offset = result.nextOffset;

    result = readField(body, offset);
    const equipment = result.value;
    offset = result.nextOffset;

    result = readField(body, offset);
    const weaponset1 = result.value;
    offset = result.nextOffset;

    result = readField(body, offset);
    const weaponset2 = result.value;
    offset = result.nextOffset;

    result = readField(body, offset);
    const weaponset3 = result.value;
    offset = result.nextOffset;

    result = readField(body, offset);
    const flagsField = result.value;
    offset = result.nextOffset;

    result = readField(body, offset);
    const playerField = result.value;
    offset = result.nextOffset;

    const descriptionResult = readLongLength(body, offset);
    const descriptionLength = descriptionResult.length;
    offset = descriptionResult.nextOffset;

    const descriptionEnd = offset + descriptionLength;

    if (descriptionEnd > body.length) {
        throw new Error(
            `Description field exceeds body: ${descriptionLength} characters`,
        );
    }

    const descriptionField = body.slice(offset, descriptionEnd);
    offset = descriptionEnd;

    const player = decodeText(playerField, encoding);

    const descriptionText = decodeText(
        descriptionField,
        encoding,
    );

    // First newline separates template name from description.
    const newline = descriptionText.indexOf('\n');

    let templateName: string;
    let description: string;

    if (newline === -1) {
    // Defensive fallback. The documented format expects a newline.
        templateName = descriptionText;
        description = '';
    }
    else {
        templateName = descriptionText.slice(0, newline);
        description = descriptionText.slice(newline + 1);
    }

    const flags = decodeFlags(flagsField);

    const decodedSkills = decodeTemplate(skills);

    if (!decodedSkills) {
        throw new Error(`Failed to decode skill template "${skills}"`);
    }

    return {
        build: {
            template: skills,
            equipment,
            weaponsets: [
                weaponset1,
                weaponset2,
                weaponset3,
            ],
            player,
            templateName,
            description,
            flags,
            skillbar: decodedSkills,
        },
        nextOffset: offset,
    };
}


/* -------------------------------------------------------------------------- */
/* Public decoder                                                              */
/* -------------------------------------------------------------------------- */

export function decodePawned(input: string): PawnedTemplate {
    // Strip a UTF-8 BOM if the template came from a text file.
    input = input.replace(/^\uFEFF/, '');

    const { header, bodyStart } = decodeHeader(input);

    const body = extractBody(input, bodyStart);

    const builds: PawnedBuild[] = [];

    let offset = 0;

    while (offset < body.length) {
        const before = offset;

        const result = decodeBuild(
            body,
            offset,
            header.encoding,
        );

        builds.push(result.build);
        offset = result.nextOffset;

        if (offset <= before) {
            throw new Error('Decoder made no progress while reading build');
        }
    }

    return {
        header,
        builds,
    };
}
