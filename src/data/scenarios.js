/* ============== CONVERSATION SCENARIOS ==============
 * Role-plays for the Talk tab. The local LLM plays `role`; `goal` is shown to
 * the learner as their task; `opener` is the partner's first line, so a chat
 * starts instantly without waiting on the model.
 */
const C = (id, ico, title, role, goal, opener) => ({ id, ico, title, role, goal, opener });

export const SCENARIOS = [
  C("hello", "你", "Meeting someone new",
    "a friendly university student meeting the learner at a party",
    "Introduce yourself: your name, where you're from and what you do.",
    { zh: "你好！我叫小王。你叫什么名字？", py: "Nǐ hǎo! Wǒ jiào Xiǎo Wáng. Nǐ jiào shénme míngzi?", en: "Hi! I'm Xiao Wang. What's your name?" }),
  C("cafe", "茶", "Ordering at a café",
    "a barista at a busy café in Beijing",
    "Order a drink, say what size you want and pay.",
    { zh: "你好！你想喝什么？", py: "Nǐ hǎo! Nǐ xiǎng hē shénme?", en: "Hello! What would you like to drink?" }),
  C("food", "饭", "At a restaurant",
    "a waiter at a small family restaurant",
    "Ask for a table for two, order two dishes and ask for the bill.",
    { zh: "欢迎光临！几位？", py: "Huānyíng guānglín! Jǐ wèi?", en: "Welcome! How many people?" }),
  C("shop", "买", "Shopping at a market",
    "a market stall owner selling fruit who likes to haggle",
    "Buy some apples and try to get a cheaper price.",
    { zh: "你要买什么？今天的苹果很好！", py: "Nǐ yào mǎi shénme? Jīntiān de píngguǒ hěn hǎo!", en: "What do you want to buy? The apples are great today!" }),
  C("way", "路", "Asking for directions",
    "a helpful local on the street",
    "Find out how to get to the subway station and how far it is.",
    { zh: "你好，你需要帮忙吗？", py: "Nǐ hǎo, nǐ xūyào bāngmáng ma?", en: "Hi, do you need help?" }),
  C("taxi", "车", "Taking a taxi",
    "a chatty taxi driver",
    "Tell the driver where you're going and chat about your trip.",
    { zh: "你好！去哪儿？", py: "Nǐ hǎo! Qù nǎr?", en: "Hello! Where to?" }),
  C("family", "家", "Talking about family",
    "a new classmate curious about the learner's family",
    "Describe your family: how many people, who they are, what they do.",
    { zh: "你家有几口人？", py: "Nǐ jiā yǒu jǐ kǒu rén?", en: "How many people are in your family?" }),
  C("plans", "周", "Weekend plans",
    "a friend making plans for the weekend",
    "Agree on what to do this weekend, and when and where to meet.",
    { zh: "这个周末你有空吗？", py: "Zhège zhōumò nǐ yǒu kòng ma?", en: "Are you free this weekend?" }),
  C("free", "聊", "Free chat",
    "a friendly Chinese language partner",
    "Talk about anything you like — your day, hobbies, food…",
    { zh: "你好！今天怎么样？", py: "Nǐ hǎo! Jīntiān zěnmeyàng?", en: "Hi! How's your day going?" }),
];

export const SCENARIO_BY_ID = new Map(SCENARIOS.map((s) => [s.id, s]));
