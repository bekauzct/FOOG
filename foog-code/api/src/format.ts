// Web dagi lib/format.ts bilan bir xil qoidalar: so‘m, U+00A0, Asia/Tashkent.
export const NBSP = ' ';
export const group = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
export const sum = (n: number) => `${group(n)}${NBSP}so‘m`;
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
/** "2026-10-16" -> "16-oktabr" */
export const fmtDateShort = (d: string) => `${Number(d.slice(8, 10))}-${MONTHS[Number(d.slice(5, 7)) - 1]}`;
