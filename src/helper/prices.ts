import { GOLD, PLATINUM } from './emoji';

export function abbreviatePrice(price: number, digits: number) {
    let value = price;
    const suffixes = ['g', 'k'];
    let suffix = 0;
    while (value >= 1000 && suffix < suffixes.length) {
        value /= 1000;
        suffix++;
    }

    return `${value.toFixed(suffix === 0 ? 0 : digits)}${suffixes[suffix]}`;
}

export function emojiPrice(price: number) {
    const currencies = [];

    if (price >= 1000) {
        currencies.push(`${Math.floor(price / 1000)} ${PLATINUM}`);
    }
    if (price % 1000 !== 0 && price !== 0) {
        currencies.push(`${price % 1000} ${GOLD}`);
    }
    return currencies.join(' ');
}