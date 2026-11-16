/* ============== SENTENCE LESSONS ==============
 * Each lesson teaches one sentence pattern with a handful of example sentences.
 *
 * S(hanzi, pinyin, english, alts?)
 *   hanzi / pinyin are split into word tiles with "|" — both must have the same
 *   number of tiles. A "，" tile is punctuation: it's shown in the answer but is
 *   never a draggable tile. Final punctuation (。？！) is added from the English.
 *   alts: other valid word orders (hanzi only, same "|" tiles), e.g. moving a
 *   time word in front of the subject.
 * Pinyin uses the spoken tone-sandhi forms for 不 and 一 (bú shì, yí ge…).
 */
const S = (hz, py, en, alts = []) => ({ hz, py, en, alts });

const RAW = [
  {
    id: "l01",
    title: "I am…",
    pattern: { zh: "A 是 B", py: "A shì B", en: "A is B" },
    note: "是 links two nouns (\"I am a student\"). Negate with 不是 (bú shì). Turn any statement into a yes/no question by adding 吗 at the end.",
    sentences: [
      S("我|是|学生", "wǒ|shì|xuésheng", "I am a student."),
      S("你|是|老师|吗", "nǐ|shì|lǎoshī|ma", "Are you a teacher?"),
      S("他|是|我|朋友", "tā|shì|wǒ|péngyou", "He is my friend."),
      S("我|不|是|老师", "wǒ|bú|shì|lǎoshī", "I am not a teacher."),
      S("她|是|我|妈妈", "tā|shì|wǒ|māma", "She is my mom."),
      S("我们|是|朋友", "wǒmen|shì|péngyou", "We are friends."),
      S("你|是|中国人|吗", "nǐ|shì|Zhōngguórén|ma", "Are you Chinese?"),
      S("我|是|美国人", "wǒ|shì|Měiguórén", "I am American."),
    ],
  },
  {
    id: "l02",
    title: "My name is…",
    pattern: { zh: "我叫 ___", py: "wǒ jiào ___", en: "I'm called ___" },
    note: "叫 means \"to be called\". The question keeps the same order — just put 什么 (what) where the answer goes. 的 marks possession: 我的名字 = my name.",
    sentences: [
      S("我|叫|小明", "wǒ|jiào|Xiǎo Míng", "My name is Xiao Ming."),
      S("你|叫|什么|名字", "nǐ|jiào|shénme|míngzi", "What is your name?"),
      S("她|叫|什么|名字", "tā|jiào|shénme|míngzi", "What is her name?"),
      S("我|的|名字|是|安娜", "wǒ|de|míngzi|shì|Ānnà", "My name is Anna."),
      S("很|高兴|认识|你", "hěn|gāoxìng|rènshi|nǐ", "Nice to meet you."),
      S("他|是|谁", "tā|shì|shéi", "Who is he?"),
    ],
  },
  {
    id: "l03",
    title: "How are you?",
    pattern: { zh: "A 很 + adjective", py: "A hěn + adj.", en: "A is (very) adj." },
    note: "Adjectives act like verbs — no 是 needed. 很 usually sits in front even when it doesn't mean \"very\". 呢 bounces the question back: 你呢? = and you?",
    sentences: [
      S("你|好|吗", "nǐ|hǎo|ma", "How are you?"),
      S("我|很|好", "wǒ|hěn|hǎo", "I am well."),
      S("你|呢", "nǐ|ne", "And you?"),
      S("我|很|累", "wǒ|hěn|lèi", "I am very tired."),
      S("今天|很|冷", "jīntiān|hěn|lěng", "It's cold today."),
      S("中文|很|难", "Zhōngwén|hěn|nán", "Chinese is hard."),
      S("这个|很|贵", "zhège|hěn|guì", "This one is expensive."),
      S("我|不|饿", "wǒ|bú|è", "I'm not hungry."),
    ],
  },
  {
    id: "l04",
    title: "I like / I want",
    pattern: { zh: "我喜欢 / 想 / 要 + verb", py: "wǒ xǐhuan / xiǎng / yào …", en: "I like / would like / want…" },
    note: "喜欢 = like, 想 = would like to, 要 = want (firmer). Put the action right after. 也 (also) goes before the verb.",
    sentences: [
      S("我|喜欢|喝|茶", "wǒ|xǐhuan|hē|chá", "I like drinking tea."),
      S("你|喜欢|吃|什么", "nǐ|xǐhuan|chī|shénme", "What do you like to eat?"),
      S("我|不|喜欢|咖啡", "wǒ|bù|xǐhuan|kāfēi", "I don't like coffee."),
      S("我|想|喝|水", "wǒ|xiǎng|hē|shuǐ", "I'd like to drink water."),
      S("我|要|一|杯|咖啡", "wǒ|yào|yì|bēi|kāfēi", "I want a cup of coffee."),
      S("她|很|喜欢|跳舞", "tā|hěn|xǐhuan|tiàowǔ", "She really likes dancing."),
      S("我|也|喜欢", "wǒ|yě|xǐhuan", "I like it too."),
    ],
  },
  {
    id: "l05",
    title: "Have / don't have",
    pattern: { zh: "A 有 / 没有 B", py: "A yǒu / méiyǒu B", en: "A has / doesn't have B" },
    note: "有 is negated with 没 — never 不. 这里有…吗? asks \"is there … here?\". Counting nouns needs a measure word: 一个哥哥 (yí ge gēge).",
    sentences: [
      S("我|有|一|个|哥哥", "wǒ|yǒu|yí|ge|gēge", "I have an older brother."),
      S("你|有|孩子|吗", "nǐ|yǒu|háizi|ma", "Do you have children?"),
      S("我|没有|钱", "wǒ|méiyǒu|qián", "I don't have money."),
      S("他|有|很|多|朋友", "tā|yǒu|hěn|duō|péngyou", "He has a lot of friends."),
      S("这里|有|洗手间|吗", "zhèlǐ|yǒu|xǐshǒujiān|ma", "Is there a bathroom here?"),
      S("我们|没有|时间", "wǒmen|méiyǒu|shíjiān", "We don't have time."),
    ],
  },
  {
    id: "l06",
    title: "Where is it?",
    pattern: { zh: "A 在 + place", py: "A zài + place", en: "A is at / in place" },
    note: "在 says where something is. Put 在 + place before a verb to say where an action happens: 在学校学习 = study at school.",
    sentences: [
      S("洗手间|在|哪里", "xǐshǒujiān|zài|nǎlǐ", "Where is the bathroom?"),
      S("我|在|家", "wǒ|zài|jiā", "I am at home."),
      S("你|在|哪里", "nǐ|zài|nǎlǐ", "Where are you?"),
      S("银行|在|那里", "yínháng|zài|nàlǐ", "The bank is over there."),
      S("我|在|学校|学习", "wǒ|zài|xuéxiào|xuéxí", "I study at school."),
      S("他|在|医院|工作", "tā|zài|yīyuàn|gōngzuò", "He works at a hospital."),
      S("车站|远|吗", "chēzhàn|yuǎn|ma", "Is the station far?"),
    ],
  },
  {
    id: "l07",
    title: "Going places",
    pattern: { zh: "A 去 + place", py: "A qù + place", en: "A goes to place" },
    note: "去 = go (there), 来 = come (here). No word for \"to\" is needed. 吧 at the end turns it into a suggestion: 我们去吧 = let's go.",
    sentences: [
      S("我|去|商店", "wǒ|qù|shāngdiàn", "I'm going to the shop."),
      S("你|去|哪里", "nǐ|qù|nǎlǐ", "Where are you going?"),
      S("我|想|去|中国", "wǒ|xiǎng|qù|Zhōngguó", "I want to go to China."),
      S("我们|一起|去|吧", "wǒmen|yìqǐ|qù|ba", "Let's go together."),
      S("他|明天|来", "tā|míngtiān|lái", "He is coming tomorrow.", ["明天|他|来"]),
      S("我|要|回家", "wǒ|yào|huí jiā", "I want to go home."),
      S("我|坐|地铁|去|机场", "wǒ|zuò|dìtiě|qù|jīchǎng", "I take the subway to the airport."),
    ],
  },
  {
    id: "l08",
    title: "When: time words",
    pattern: { zh: "A + time + verb", py: "A + time + verb", en: "A does it at a time" },
    note: "Time words go before the verb — either right after the subject or at the very start. Both 我今天很忙 and 今天我很忙 are correct.",
    sentences: [
      S("我|今天|很|忙", "wǒ|jīntiān|hěn|máng", "I'm busy today.", ["今天|我|很|忙"]),
      S("你|明天|工作|吗", "nǐ|míngtiān|gōngzuò|ma", "Do you work tomorrow?", ["明天|你|工作|吗"]),
      S("我|早上|喝|咖啡", "wǒ|zǎoshang|hē|kāfēi", "I drink coffee in the morning.", ["早上|我|喝|咖啡"]),
      S("现在|几|点", "xiànzài|jǐ|diǎn", "What time is it now?"),
      S("我|每天|学习|中文", "wǒ|měitiān|xuéxí|Zhōngwén", "I study Chinese every day.", ["每天|我|学习|中文"]),
      S("我们|晚上|见", "wǒmen|wǎnshang|jiàn", "See you tonight."),
      S("星期六|我|休息", "xīngqīliù|wǒ|xiūxi", "I rest on Saturdays.", ["我|星期六|休息"]),
    ],
  },
  {
    id: "l09",
    title: "Numbers & money",
    pattern: { zh: "number + measure + noun", py: "number + measure + noun", en: "two apples, three books…" },
    note: "Numbers need a measure word before the noun: 两个苹果, 三本书. Use 两 (liǎng), not 二, for \"two of something\". 块 is spoken \"yuan\".",
    sentences: [
      S("这个|多少|钱", "zhège|duōshao|qián", "How much is this?"),
      S("十|块|钱", "shí|kuài|qián", "Ten yuan."),
      S("我|要|两|个|苹果", "wǒ|yào|liǎng|ge|píngguǒ", "I want two apples."),
      S("太|贵|了", "tài|guì|le", "Too expensive!"),
      S("可以|便宜|一点|吗", "kěyǐ|piányi|yìdiǎn|ma", "Can you make it a bit cheaper?"),
      S("我|有|三|本|书", "wǒ|yǒu|sān|běn|shū", "I have three books."),
      S("我|二十五|岁", "wǒ|èrshíwǔ|suì", "I am 25 years old."),
    ],
  },
  {
    id: "l10",
    title: "Done it: 了",
    pattern: { zh: "verb + 了", py: "verb + le", en: "did / has done" },
    note: "了 after a verb marks a completed action; at the end of a sentence it marks a change (我饿了 = I've got hungry). The negative is 没 / 还没 with no 了.",
    sentences: [
      S("我|吃|饭|了", "wǒ|chī|fàn|le", "I've eaten."),
      S("你|吃|饭|了|吗", "nǐ|chī|fàn|le|ma", "Have you eaten?"),
      S("我|饿|了", "wǒ|è|le", "I'm hungry now."),
      S("他|走|了", "tā|zǒu|le", "He has left."),
      S("我|买|了|一|本|书", "wǒ|mǎi|le|yì|běn|shū", "I bought a book."),
      S("我|还没|吃", "wǒ|hái méi|chī", "I haven't eaten yet."),
      S("我|昨天|去|了|公园", "wǒ|zuótiān|qù|le|gōngyuán", "I went to the park yesterday.", ["昨天|我|去|了|公园"]),
    ],
  },
  {
    id: "l11",
    title: "Can you…?",
    pattern: { zh: "会 / 能 / 可以 + verb", py: "huì / néng / kěyǐ + verb", en: "can (skill / able / allowed)" },
    note: "会 = a learned skill (speak, drive). 能 = physically able. 可以 = allowed / may. All three sit right before the verb.",
    sentences: [
      S("你|会|说|中文|吗", "nǐ|huì|shuō|Zhōngwén|ma", "Can you speak Chinese?"),
      S("我|会|说|一点|中文", "wǒ|huì|shuō|yìdiǎn|Zhōngwén", "I can speak a little Chinese."),
      S("我|不|会|开车", "wǒ|bú|huì|kāichē", "I can't drive."),
      S("我|可以|坐|这里|吗", "wǒ|kěyǐ|zuò|zhèlǐ|ma", "May I sit here?"),
      S("你|能|帮|我|吗", "nǐ|néng|bāng|wǒ|ma", "Can you help me?"),
      S("这里|不|能|拍照", "zhèlǐ|bù|néng|pāizhào", "You can't take photos here."),
    ],
  },
  {
    id: "l12",
    title: "Question words",
    pattern: { zh: "什么 · 谁 · 哪里 · 为什么 · 怎么", py: "shénme · shéi · nǎlǐ · wèishénme · zěnme", en: "what · who · where · why · how" },
    note: "Question words stay where the answer would be — no word-order flip like English. 为什么 and 怎么 go before the verb.",
    sentences: [
      S("这|是|什么", "zhè|shì|shénme", "What is this?"),
      S("你|为什么|学|中文", "nǐ|wèishénme|xué|Zhōngwén", "Why are you learning Chinese?"),
      S("去|机场|怎么|走", "qù|jīchǎng|zěnme|zǒu", "How do I get to the airport?"),
      S("你|什么时候|回家", "nǐ|shénme shíhou|huí jiā", "When are you going home?"),
      S("你|想|吃|什么", "nǐ|xiǎng|chī|shénme", "What do you want to eat?"),
      S("天气|怎么样", "tiānqì|zěnmeyàng", "How's the weather?"),
    ],
  },
  {
    id: "l13",
    title: "At a restaurant",
    pattern: { zh: "请给我 ___", py: "qǐng gěi wǒ ___", en: "please give me ___" },
    note: "请 makes any request polite. Order with 我要 + number + measure word + dish. 不要 = don't (add / give).",
    sentences: [
      S("请|给|我|菜单", "qǐng|gěi|wǒ|càidān", "Please give me the menu."),
      S("我|要|一|碗|面条", "wǒ|yào|yì|wǎn|miàntiáo", "I'd like a bowl of noodles."),
      S("我们|要|两|杯|茶", "wǒmen|yào|liǎng|bēi|chá", "We'd like two cups of tea."),
      S("不要|放|糖", "búyào|fàng|táng", "No sugar, please."),
      S("我|不|吃|肉", "wǒ|bù|chī|ròu", "I don't eat meat."),
      S("这个|菜|很|好吃", "zhège|cài|hěn|hǎochī", "This dish is delicious."),
      S("服务员|，|买单", "fúwùyuán|,|mǎidān", "Waiter, the bill!"),
    ],
  },
  {
    id: "l14",
    title: "My day",
    pattern: { zh: "A + time + 在 place + verb", py: "A + time + zài place + verb", en: "who · when · where · what" },
    note: "The core Chinese order: subject → time → place → action. Clock times use 点: 七点 = seven o'clock.",
    sentences: [
      S("我|七|点|起床", "wǒ|qī|diǎn|qǐchuáng", "I get up at seven.", ["七|点|我|起床"]),
      S("我|在|家|吃|早饭", "wǒ|zài|jiā|chī|zǎofàn", "I eat breakfast at home."),
      S("我|坐|地铁|上班", "wǒ|zuò|dìtiě|shàngbān", "I take the subway to work."),
      S("我|晚上|十一|点|睡觉", "wǒ|wǎnshang|shíyī|diǎn|shuìjiào", "I go to bed at 11 at night.", ["晚上|十一|点|我|睡觉"]),
      S("你|周末|做|什么", "nǐ|zhōumò|zuò|shénme", "What do you do on weekends?", ["周末|你|做|什么"]),
      S("我|喜欢|在|公园|跑步", "wǒ|xǐhuan|zài|gōngyuán|pǎobù", "I like running in the park."),
    ],
  },
  {
    id: "l15",
    title: "Linking ideas",
    pattern: { zh: "因为…所以… · 但是 · 如果", py: "yīnwèi… suǒyǐ… · dànshì · rúguǒ", en: "because… so… · but · if" },
    note: "Chinese often uses connectors in pairs: 因为…所以… (because… so…). 太…了 = so / too…! 先…然后… = first… then….",
    sentences: [
      S("因为|下雨|，|所以|我|不|去", "yīnwèi|xiàyǔ|,|suǒyǐ|wǒ|bú|qù", "Because it's raining, I'm not going."),
      S("我|想|去|，|但是|我|没有|时间", "wǒ|xiǎng|qù|,|dànshì|wǒ|méiyǒu|shíjiān", "I want to go, but I don't have time."),
      S("如果|你|有|时间|，|我们|一起|去|吧", "rúguǒ|nǐ|yǒu|shíjiān|,|wǒmen|yìqǐ|qù|ba", "If you have time, let's go together."),
      S("今天|太|热|了", "jīntiān|tài|rè|le", "It's so hot today!"),
      S("我|先|吃|饭|，|然后|睡觉", "wǒ|xiān|chī|fàn|,|ránhòu|shuìjiào", "I'll eat first, then sleep."),
      S("我|也|很|喜欢|中文", "wǒ|yě|hěn|xǐhuan|Zhōngwén", "I also really like Chinese."),
    ],
  },
  {
    id: "l16",
    title: "Say that again?",
    pattern: { zh: "请 + verb · …怎么说？", py: "qǐng + verb · … zěnme shuō?", en: "please … · how do you say …?" },
    note: "The phrases that keep a conversation alive when you get lost. 请 in front makes any request polite. 用中文怎么说 = how do you say it in Chinese. 不太 + adjective = not very.",
    sentences: [
      S("请|再|说|一|遍", "qǐng|zài|shuō|yí|biàn", "Please say it again."),
      S("请|说|慢|一点", "qǐng|shuō|màn|yìdiǎn", "Please speak a bit slower."),
      S("我|听不懂", "wǒ|tīng bu dǒng", "I can't follow what you're saying."),
      S("这个|用|中文|怎么|说", "zhège|yòng|Zhōngwén|zěnme|shuō", "How do you say this in Chinese?"),
      S("这|是|什么|意思", "zhè|shì|shénme|yìsi", "What does this mean?"),
      S("你|会|说|英文|吗", "nǐ|huì|shuō|Yīngwén|ma", "Can you speak English?"),
      S("我|的|中文|不|太|好", "wǒ|de|Zhōngwén|bú|tài|hǎo", "My Chinese isn't very good."),
    ],
  },
  {
    id: "l17",
    title: "Comparing",
    pattern: { zh: "A 比 B + adjective", py: "A bǐ B + adj.", en: "A is more adj. than B" },
    note: "比 compares two things — and the adjective stands alone, with no 很. The negative is A 没有 B + adjective (not as … as). 更 = even more, 最 = the most.",
    sentences: [
      S("今天|比|昨天|冷", "jīntiān|bǐ|zuótiān|lěng", "Today is colder than yesterday."),
      S("他|比|我|高", "tā|bǐ|wǒ|gāo", "He is taller than me."),
      S("这个|比|那个|贵", "zhège|bǐ|nàge|guì", "This one is more expensive than that one."),
      S("我|没有|他|忙", "wǒ|méiyǒu|tā|máng", "I'm not as busy as him."),
      S("哪|个|最|好", "nǎ|ge|zuì|hǎo", "Which one is the best?"),
      S("我|最|喜欢|吃|面条", "wǒ|zuì|xǐhuan|chī|miàntiáo", "I like eating noodles the most."),
      S("这个|更|便宜", "zhège|gèng|piányi", "This one is even cheaper."),
    ],
  },
  {
    id: "l18",
    title: "Right now & ever",
    pattern: { zh: "在 + verb · verb + 过", py: "zài + verb · verb + guo", en: "be doing · have ever done" },
    note: "在 (or 正在) before a verb means the action is happening right now. 过 after a verb means you've had the experience at least once; its negative is 没 + verb + 过.",
    sentences: [
      S("我|在|吃|饭", "wǒ|zài|chī|fàn", "I'm eating."),
      S("你|在|做|什么", "nǐ|zài|zuò|shénme", "What are you doing?"),
      S("他|在|打电话", "tā|zài|dǎ diànhuà", "He's on the phone."),
      S("我|正在|学习|中文", "wǒ|zhèngzài|xuéxí|Zhōngwén", "I'm studying Chinese right now."),
      S("我|去|过|中国", "wǒ|qù|guo|Zhōngguó", "I've been to China."),
      S("你|吃|过|饺子|吗", "nǐ|chī|guo|jiǎozi|ma", "Have you ever eaten dumplings?"),
      S("我|没|看|过|这|本|书", "wǒ|méi|kàn|guo|zhè|běn|shū", "I haven't read this book."),
    ],
  },
  {
    id: "l19",
    title: "Giving directions",
    pattern: { zh: "往 + direction + 拐 · A 离 B 近 / 远", py: "wǎng + direction + guǎi · A lí B jìn / yuǎn", en: "turn … · A is near / far from B" },
    note: "往 points the way: 往左拐 = turn left. 离 measures distance between two places — A 离 B 很近. Positions go after 在: 在医院旁边 = next to the hospital.",
    sentences: [
      S("一直|走", "yìzhí|zǒu", "Go straight ahead."),
      S("往|左|拐", "wǎng|zuǒ|guǎi", "Turn left."),
      S("往|右|拐", "wǎng|yòu|guǎi", "Turn right."),
      S("地铁站|离|这里|很|近", "dìtiězhàn|lí|zhèlǐ|hěn|jìn", "The subway station is close to here."),
      S("机场|离|这里|远|吗", "jīchǎng|lí|zhèlǐ|yuǎn|ma", "Is the airport far from here?"),
      S("银行|在|医院|旁边", "yínháng|zài|yīyuàn|pángbiān", "The bank is next to the hospital."),
      S("走路|五|分钟", "zǒulù|wǔ|fēnzhōng", "It's a five-minute walk."),
    ],
  },
  {
    id: "l20",
    title: "Making a time",
    pattern: { zh: "从 A 到 B · 几点", py: "cóng A dào B · jǐ diǎn", en: "from A to B · what time" },
    note: "从…到… frames a stretch of time (or space). 半 = half past: 两点半. 一下 after a verb softens it to \"for a moment\". 多长时间 asks how long something takes.",
    sentences: [
      S("我们|几|点|见", "wǒmen|jǐ|diǎn|jiàn", "What time shall we meet?"),
      S("明天|下午|三|点|可以|吗", "míngtiān|xiàwǔ|sān|diǎn|kěyǐ|ma", "Is three tomorrow afternoon OK?"),
      S("我|从|九|点|到|五|点|工作", "wǒ|cóng|jiǔ|diǎn|dào|wǔ|diǎn|gōngzuò", "I work from nine to five."),
      S("现在|两|点|半", "xiànzài|liǎng|diǎn|bàn", "It's half past two now."),
      S("你|等|我|一下", "nǐ|děng|wǒ|yíxià", "Wait for me a moment."),
      S("对不起|，|我|来|晚|了", "duìbuqǐ|,|wǒ|lái|wǎn|le", "Sorry, I'm late."),
      S("要|多|长|时间", "yào|duō|cháng|shíjiān", "How long does it take?"),
    ],
  },
  {
    id: "l21",
    title: "Feeling unwell",
    pattern: { zh: "我 + body part + 疼 · 应该 / 得 + verb", py: "wǒ … téng · yīnggāi / děi + verb", en: "my … hurts · should / have to" },
    note: "Say what hurts with body part + 疼, no 是 needed. 应该 = should (advice), 得 (děi) = have to. 怎么了 asks what's wrong.",
    sentences: [
      S("你|怎么|了", "nǐ|zěnme|le", "What's wrong?"),
      S("我|不|舒服", "wǒ|bù|shūfu", "I don't feel well."),
      S("我|头|疼", "wǒ|tóu|téng", "I have a headache."),
      S("我|感冒|了", "wǒ|gǎnmào|le", "I've caught a cold."),
      S("你|应该|多|喝|水", "nǐ|yīnggāi|duō|hē|shuǐ", "You should drink more water."),
      S("我|得|去|医院", "wǒ|děi|qù|yīyuàn", "I have to go to the hospital."),
      S("这个|药|一|天|吃|三|次", "zhège|yào|yì|tiān|chī|sān|cì", "Take this medicine three times a day."),
      S("我|想|休息|一下", "wǒ|xiǎng|xiūxi|yíxià", "I'd like to rest for a bit."),
    ],
  },
  {
    id: "l22",
    title: "Shopping for clothes",
    pattern: { zh: "可以 + verb + 吗 · 有没有 ___", py: "kěyǐ + verb + ma · yǒu méiyǒu ___", en: "may I … · do you have ___" },
    note: "件 is the measure word for clothes. 有没有 asks \"do you have\" without 吗. Adjective + 一点 + 的 = a …-er one: 大一点的 = a bigger one. Colour + 的 = the … one.",
    sentences: [
      S("我|想|买|这|件|衣服", "wǒ|xiǎng|mǎi|zhè|jiàn|yīfu", "I'd like to buy this piece of clothing."),
      S("可以|试|一下|吗", "kěyǐ|shì|yíxià|ma", "Can I try it on?"),
      S("这|件|太|小|了", "zhè|jiàn|tài|xiǎo|le", "This one is too small."),
      S("有没有|大|一点|的", "yǒu méiyǒu|dà|yìdiǎn|de", "Do you have a bigger one?"),
      S("有|别的|颜色|吗", "yǒu|biéde|yánsè|ma", "Do you have other colors?"),
      S("我|喜欢|红色|的", "wǒ|xǐhuan|hóngsè|de", "I like the red one."),
      S("可以|刷卡|吗", "kěyǐ|shuākǎ|ma", "Can I pay by card?"),
    ],
  },
  {
    id: "l23",
    title: "Plans & intentions",
    pattern: { zh: "打算 / 要 / 会 + verb", py: "dǎsuàn / yào / huì + verb", en: "plan to / going to / will" },
    note: "Chinese has no future tense: a time word plus 要 (going to), 会 (will, likely) or 打算 (plan to) does the job. 快…了 = about to. 下个 = next: 下个星期.",
    sentences: [
      S("我|打算|明年|去|中国", "wǒ|dǎsuàn|míngnián|qù|Zhōngguó", "I plan to go to China next year."),
      S("明天|会|下雨", "míngtiān|huì|xiàyǔ", "It will rain tomorrow."),
      S("我|下|个|星期|很|忙", "wǒ|xià|ge|xīngqī|hěn|máng", "I'm busy next week.", ["下|个|星期|我|很|忙"]),
      S("你|周末|有|什么|打算", "nǐ|zhōumò|yǒu|shénme|dǎsuàn", "What are your plans for the weekend?", ["周末|你|有|什么|打算"]),
      S("我|要|去|看|朋友", "wǒ|yào|qù|kàn|péngyou", "I'm going to visit a friend."),
      S("我们|快|到|了", "wǒmen|kuài|dào|le", "We're almost there."),
      S("我|一定|来", "wǒ|yídìng|lái", "I'll definitely come."),
    ],
  },
  {
    id: "l24",
    title: "What do you think?",
    pattern: { zh: "我觉得… · adj. 不 adj.？", py: "wǒ juéde… · adj. bu adj.?", en: "I think… · is it … or not?" },
    note: "觉得 gives an opinion or a feeling. Repeating a word around 不 makes a yes/no question without 吗: 好不好? 忙不忙? Verb + 得 + adjective says how well something is done.",
    sentences: [
      S("你|觉得|怎么样", "nǐ|juéde|zěnmeyàng", "What do you think?"),
      S("我|觉得|很|有意思", "wǒ|juéde|hěn|yǒu yìsi", "I think it's really interesting."),
      S("我|觉得|不|太|好", "wǒ|juéde|bú|tài|hǎo", "I don't think it's very good."),
      S("好|不|好", "hǎo|bu|hǎo", "Is that OK?"),
      S("你|忙|不|忙", "nǐ|máng|bu|máng", "Are you busy?"),
      S("我|同意", "wǒ|tóngyì", "I agree."),
      S("你|说|得|对", "nǐ|shuō|de|duì", "You're right."),
    ],
  },
  {
    id: "l25",
    title: "Inviting & staying in touch",
    pattern: { zh: "请 + person + verb · 给 + person + verb", py: "qǐng + person + verb · gěi + person + verb", en: "treat someone to … · do … for / to someone" },
    note: "请 + person + verb invites them (and implies you're paying). 给 + person comes before the verb: 给你打电话 = call you. 下次 = next time.",
    sentences: [
      S("我|请|你|吃|饭", "wǒ|qǐng|nǐ|chī|fàn", "Let me treat you to a meal."),
      S("你|想|一起|去|吗", "nǐ|xiǎng|yìqǐ|qù|ma", "Do you want to go together?"),
      S("我|给|你|打电话", "wǒ|gěi|nǐ|dǎ diànhuà", "I'll call you."),
      S("你|的|电话|号码|是|多少", "nǐ|de|diànhuà|hàomǎ|shì|duōshao", "What's your phone number?"),
      S("我们|加|个|微信|吧", "wǒmen|jiā|ge|Wēixìn|ba", "Let's add each other on WeChat."),
      S("下|次|见", "xià|cì|jiàn", "See you next time."),
      S("好|的|，|没问题", "hǎo|de|,|méi wèntí", "OK, no problem."),
    ],
  },
];

export const isPunct = (t) => t.hz === "，";

function endPunct(en) {
  if (en.endsWith("?")) return "？";
  if (en.endsWith("!")) return "！";
  return "。";
}

function buildSentence(raw, lessonId, idx) {
  const hzs = raw.hz.split("|");
  const pys = raw.py.split("|");
  const tokens = hzs.map((hz, i) => ({ hz, py: pys[i] }));
  const words = tokens.filter((t) => !isPunct(t));
  const text = tokens.map((t) => t.hz).join("");
  return {
    id: `${lessonId}-${idx + 1}`,
    key: "s:" + text,
    lessonId,
    en: raw.en,
    tokens,
    words,
    text: text + endPunct(raw.en),
    pinyin: tokens
      .map((t) => t.py)
      .join(" ")
      .replace(/ ,/g, ","),
    answers: [words.map((t) => t.hz).join(""), ...raw.alts.map((a) => a.replace(/[|，]/g, ""))],
    _rawCounts: [hzs.length, pys.length],
  };
}

export const LESSONS = RAW.map((l, li) => ({
  ...l,
  n: li + 1,
  sentences: l.sentences.map((s, i) => buildSentence(s, l.id, i)),
}));

/* Units group the path on the Learn tab: five lessons each. */
export const UNITS = [
  { n: 1, title: "First words", zh: "你好", hue: "seal" },
  { n: 2, title: "Out and about", zh: "出门", hue: "sky" },
  { n: 3, title: "Real life", zh: "生活", hue: "jade" },
  { n: 4, title: "Keep it flowing", zh: "聊天", hue: "plum" },
  { n: 5, title: "Everyday situations", zh: "办事", hue: "gold" },
].map((u, i) => ({ ...u, lessons: LESSONS.slice(i * 5, i * 5 + 5) }));

export const LESSON_BY_ID = new Map(LESSONS.map((l) => [l.id, l]));
export const ALL_SENTENCES = LESSONS.flatMap((l) => l.sentences);
export const SENTENCE_BY_KEY = new Map(ALL_SENTENCES.map((s) => [s.key, s]));
