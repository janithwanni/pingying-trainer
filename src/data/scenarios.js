/* ============== CONVERSATION SCENARIOS ==============
 * Role-plays for the Talk tab, shared with functions/api/talk.js (which builds
 * the prompt from them). The AI partner plays `role`; `goal` is shown to
 * the learner as their task; `opener` is the partner's first line, so a chat
 * starts instantly without waiting on the model. `after` is the lesson that
 * prepares the learner for it (the app suggests the scenario once that lesson
 * is done) and `cando` is the skill it stands for on the Progress tab.
 */
const C = (id, ico, title, after, cando, role, goal, opener) => ({ id, ico, title, after, cando, role, goal, opener });

export const SCENARIOS = [
  C("hello", "你", "Meeting someone new", "l02", "Introduce myself",
    "a friendly university student meeting the learner at a party",
    "Introduce yourself: your name, where you're from and what you do.",
    { zh: "你好！我叫小王。你叫什么名字？", py: "Nǐ hǎo! Wǒ jiào Xiǎo Wáng. Nǐ jiào shénme míngzi?", en: "Hi! I'm Xiao Wang. What's your name?" }),
  C("cafe", "茶", "Ordering at a café", "l04", "Order a drink",
    "a barista at a busy café in Beijing",
    "Order a drink, say what size you want and pay.",
    { zh: "你好！你想喝什么？", py: "Nǐ hǎo! Nǐ xiǎng hē shénme?", en: "Hello! What would you like to drink?" }),
  C("food", "饭", "At a restaurant", "l13", "Eat at a restaurant",
    "a waiter at a small family restaurant",
    "Ask for a table for two, order two dishes and ask for the bill.",
    { zh: "欢迎光临！几位？", py: "Huānyíng guānglín! Jǐ wèi?", en: "Welcome! How many people?" }),
  C("shop", "买", "Shopping at a market", "l09", "Shop and talk prices",
    "a market stall owner selling fruit who likes to haggle",
    "Buy some apples and try to get a cheaper price.",
    { zh: "你要买什么？今天的苹果很好！", py: "Nǐ yào mǎi shénme? Jīntiān de píngguǒ hěn hǎo!", en: "What do you want to buy? The apples are great today!" }),
  C("way", "路", "Asking for directions", "l06", "Ask the way",
    "a helpful local on the street",
    "Find out how to get to the subway station and how far it is.",
    { zh: "你好，你需要帮忙吗？", py: "Nǐ hǎo, nǐ xūyào bāngmáng ma?", en: "Hi, do you need help?" }),
  C("taxi", "车", "Taking a taxi", "l07", "Take a taxi",
    "a chatty taxi driver",
    "Tell the driver where you're going and chat about your trip.",
    { zh: "你好！去哪儿？", py: "Nǐ hǎo! Qù nǎr?", en: "Hello! Where to?" }),
  C("family", "家", "Talking about family", "l05", "Talk about my family",
    "a new classmate curious about the learner's family",
    "Describe your family: how many people, who they are, what they do.",
    { zh: "你家有几口人？", py: "Nǐ jiā yǒu jǐ kǒu rén?", en: "How many people are in your family?" }),
  C("plans", "周", "Weekend plans", "l08", "Make plans with a friend",
    "a friend making plans for the weekend",
    "Agree on what to do this weekend, and when and where to meet.",
    { zh: "这个周末你有空吗？", py: "Zhège zhōumò nǐ yǒu kòng ma?", en: "Are you free this weekend?" }),
  C("free", "聊", "Free chat", "l03", "Make small talk",
    "a friendly Chinese language partner",
    "Talk about anything you like — your day, hobbies, food…",
    { zh: "你好！今天怎么样？", py: "Nǐ hǎo! Jīntiān zěnmeyàng?", en: "Hi! How's your day going?" }),
  C("help", "问", "Lost in translation", "l16", "Ask someone to repeat or explain",
    "a shop assistant who talks fast and uses a few difficult words",
    "Get them to say it again, slow down, and explain a word you don't know.",
    { zh: "你好！欢迎光临，今天我们有特价活动！", py: "Nǐ hǎo! Huānyíng guānglín, jīntiān wǒmen yǒu tèjià huódòng!", en: "Hello! Welcome — we have a special offer on today!" }),
  C("doctor", "医", "At the doctor's", "l21", "Explain how I feel",
    "a kind doctor at a clinic",
    "Say what's wrong, answer the doctor's questions and find out what to do.",
    { zh: "你好，请坐。你哪里不舒服？", py: "Nǐ hǎo, qǐng zuò. Nǐ nǎlǐ bù shūfu?", en: "Hello, please sit down. Where does it hurt?" }),
  C("clothes", "衣", "Buying clothes", "l22", "Buy clothes",
    "a shop assistant in a clothing store",
    "Ask to try something on, get a different size or colour, and pay.",
    { zh: "欢迎光临！你想买什么？", py: "Huānyíng guānglín! Nǐ xiǎng mǎi shénme?", en: "Welcome! What would you like to buy?" }),
  C("invite", "约", "Meeting up again", "l25", "Invite someone and swap contacts",
    "a new friend the learner just met at a language exchange",
    "Invite them to dinner, agree on a time, and swap phone numbers or WeChat.",
    { zh: "今天认识你很高兴！", py: "Jīntiān rènshi nǐ hěn gāoxìng!", en: "It was great meeting you today!" }),
];

export const SCENARIO_BY_ID = new Map(SCENARIOS.map((s) => [s.id, s]));

/* Learner levels: shown in the Talk tab and used in the prompt (functions/api/talk.js). */
export const LEVELS = {
  beginner: { label: "Beginner", hsk: "HSK 1–2", style: "very short, simple sentences" },
  elementary: { label: "Elementary", hsk: "HSK 1–3", style: "short, natural sentences" },
};
