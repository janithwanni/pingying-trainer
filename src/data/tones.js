/* ============== TONE & SOUND TRAINER DATA ==============
 * Everything here is played through the device's Mandarin voice, so the
 * characters are common ones with a single everyday reading.
 */
export const TONES = [
  { n: 1, name: "1st tone", shape: "high and level", tip: "Hold one high note, like singing “laaa”.", mark: "ā", hz: "妈", py: "mā", en: "mother" },
  { n: 2, name: "2nd tone", shape: "rising", tip: "Rise like asking “what?”", mark: "á", hz: "麻", py: "má", en: "hemp" },
  { n: 3, name: "3rd tone", shape: "low, dipping", tip: "Drop to the bottom of your voice, then lift a little.", mark: "ǎ", hz: "马", py: "mǎ", en: "horse" },
  { n: 4, name: "4th tone", shape: "falling", tip: "Fall sharply, like a firm “No!”", mark: "à", hz: "骂", py: "mà", en: "to scold" },
];

/* Pitch shape of each tone on the usual 5-level scale: [time 0–1, height 0–1]. */
export const SHAPES = {
  1: [[0, 0.9], [1, 0.9]],
  2: [[0, 0.45], [1, 0.95]],
  3: [[0, 0.4], [0.45, 0.06], [1, 0.55]],
  4: [[0, 1], [1, 0.08]],
};

const list = (tone, str) => str.split(" ").map((x) => ({ hz: x.split(":")[0], py: x.split(":")[1], tone }));
/* Single syllables for "which tone do you hear?" and the tone mirror. */
export const SYLLABLES = [
  ...list(1, "妈:mā 八:bā 七:qī 三:sān 书:shū 天:tiān 高:gāo 吃:chī 喝:hē 说:shuō 猫:māo 山:shān 飞:fēi 多:duō 新:xīn"),
  ...list(2, "麻:má 十:shí 人:rén 茶:chá 钱:qián 来:lái 忙:máng 学:xué 国:guó 鱼:yú 门:mén 红:hóng 白:bái 您:nín 读:dú"),
  ...list(3, "马:mǎ 我:wǒ 你:nǐ 五:wǔ 九:jiǔ 水:shuǐ 小:xiǎo 买:mǎi 走:zǒu 早:zǎo 好:hǎo 女:nǚ 雨:yǔ 有:yǒu 狗:gǒu"),
  ...list(4, "骂:mà 四:sì 六:liù 是:shì 大:dà 去:qù 看:kàn 饭:fàn 爱:ài 路:lù 快:kuài 二:èr 月:yuè 对:duì 卖:mài"),
];

/* Two-syllable words with two full tones (no neutral tones, no 3rd + 3rd,
 * no 一 / 不), so what you hear is what's written. */
export const PAIRS = [
  ["今天", "jīntiān", 1, 1], ["咖啡", "kāfēi", 1, 1], ["中国", "Zhōngguó", 1, 2], ["机场", "jīchǎng", 1, 3],
  ["高兴", "gāoxìng", 1, 4], ["医院", "yīyuàn", 1, 4], ["明天", "míngtiān", 2, 1], ["学习", "xuéxí", 2, 2],
  ["银行", "yínháng", 2, 2], ["苹果", "píngguǒ", 2, 3], ["牛奶", "niúnǎi", 2, 3], ["学校", "xuéxiào", 2, 4],
  ["老师", "lǎoshī", 3, 1], ["好吃", "hǎochī", 3, 1], ["北京", "Běijīng", 3, 1], ["美国", "Měiguó", 3, 2],
  ["起床", "qǐchuáng", 3, 2], ["早饭", "zǎofàn", 3, 4], ["跑步", "pǎobù", 3, 4], ["上班", "shàngbān", 4, 1],
  ["面条", "miàntiáo", 4, 2], ["问题", "wèntí", 4, 2], ["地铁", "dìtiě", 4, 3], ["上海", "Shànghǎi", 4, 3],
  ["再见", "zàijiàn", 4, 4], ["电话", "diànhuà", 4, 4], ["睡觉", "shuìjiào", 4, 4],
].map(([hz, py, a, b]) => ({ hz, py, tones: [a, b] }));

/* Sounds English speakers mix up: pairs that differ in one sound only. */
const P = (focus, tip, a, b) => ({ focus, tip, a: { hz: a[0], py: a[1] }, b: { hz: b[0], py: b[1] } });
export const SOUNDS = [
  P("z / zh", "z: tongue tip behind the top teeth. zh: curl the tongue tip back.", ["字", "zì"], ["志", "zhì"]),
  P("z / zh", "z: tongue tip behind the top teeth. zh: curl the tongue tip back.", ["早", "zǎo"], ["找", "zhǎo"]),
  P("c / ch", "c is “ts” with a puff of air. ch is the same puff with the tongue curled back.", ["粗", "cū"], ["出", "chū"]),
  P("c / ch", "c is “ts” with a puff of air. ch is the same puff with the tongue curled back.", ["层", "céng"], ["成", "chéng"]),
  P("s / sh", "s: flat tongue, like English “s”. sh: tongue curled back, darker sound.", ["四", "sì"], ["是", "shì"]),
  P("s / sh", "s: flat tongue, like English “s”. sh: tongue curled back, darker sound.", ["三", "sān"], ["山", "shān"]),
  P("j / zh", "j: tongue flat, smiling lips. zh: tongue curled back, rounder lips.", ["鸡", "jī"], ["知", "zhī"]),
  P("q / ch", "q: tongue flat, a bright “chee”. ch: tongue curled back.", ["七", "qī"], ["吃", "chī"]),
  P("x / sh", "x: tongue flat behind the lower teeth, smile. sh: tongue curled back.", ["西", "xī"], ["师", "shī"]),
  P("x / sh", "x: tongue flat behind the lower teeth, smile. sh: tongue curled back.", ["心", "xīn"], ["身", "shēn"]),
  P("u / ü", "ü: say “ee”, then round your lips without moving your tongue.", ["路", "lù"], ["绿", "lǜ"]),
  P("u / ü", "ü: say “ee”, then round your lips without moving your tongue.", ["努", "nǔ"], ["女", "nǚ"]),
  P("n / ng", "-n ends with the tongue tip up front. -ng ends at the back, as in “sing”.", ["民", "mín"], ["名", "míng"]),
  P("n / ng", "-n ends with the tongue tip up front. -ng ends at the back, as in “sing”.", ["金", "jīn"], ["经", "jīng"]),
  P("n / ng", "-n ends with the tongue tip up front. -ng ends at the back, as in “sing”.", ["班", "bān"], ["帮", "bāng"]),
  P("b / p", "Both are unvoiced. p has a strong puff of air; b has none.", ["爸", "bà"], ["怕", "pà"]),
  P("d / t", "Both are unvoiced. t has a strong puff of air; d has none.", ["读", "dú"], ["图", "tú"]),
  P("g / k", "Both are unvoiced. k has a strong puff of air; g has none.", ["狗", "gǒu"], ["口", "kǒu"]),
  P("r / l", "r: tongue curled back, close to the “s” in “pleasure”. l: as in English.", ["肉", "ròu"], ["漏", "lòu"]),
  P("tone 3 / tone 4", "Same sounds, different tone — and a different word.", ["买", "mǎi"], ["卖", "mài"]),
  P("tone 1 / tone 2", "Same sounds, different tone — and a different word.", ["汤", "tāng"], ["糖", "táng"]),
  P("tone 3 / tone 4", "Same sounds, different tone — and a different word.", ["吻", "wěn"], ["问", "wèn"]),
];
