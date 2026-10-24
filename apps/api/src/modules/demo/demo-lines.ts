/** What the demo bots say (demo-bots.service.ts), in English and Russian. */

export type BotLang = 'en' | 'ru';

export const BOT_COMMENTS: Record<BotLang, string[]> = {
  en: [
    'Love this! 😍',
    'Wow 🔥',
    'This is so good',
    'Obsessed 😍',
    'Goals!',
    'Stunning 👏',
    'Haha 😂',
    'Saved!',
    'The vibes ✨',
    'Okay this is art',
    'Need more posts like this',
    'Made my day ☀️',
    'Iconic',
    'No way 😮',
    'Beautiful!',
  ],
  ru: [
    'Обожаю! 😍',
    'Огонь 🔥',
    'Красота 👏',
    'Ахаха 😂',
    'Сохранила!',
    'Настроение ✨',
    'Вау 😮',
    'Супер!',
    'Хочу так же',
    'Как красиво!',
    'Лучшее за сегодня',
    'Шедевр',
  ],
};

/** A bot writing first to someone who is online */
export const BOT_OPENERS: Record<BotLang, string[]> = {
  en: [
    'Hey! Love your posts 😍',
    'Hi! Where was your last photo taken?',
    'Hey 👋 your feed is so aesthetic',
    'Your last post made my day 😂',
    'Hi! Are you going to the meetup on Saturday?',
  ],
  ru: [
    'Привет! Классные посты 😍',
    'Привет! Где снимала последнее фото?',
    'Привет 👋 очень красивая лента',
    'Последний пост поднял настроение 😂',
    'Привет! Ты в субботу будешь?',
  ],
};

type Rule = { test: RegExp; en: string[]; ru: string[] };

/** Replies to a message, by what it says; the first matching rule wins */
const RULES: Rule[] = [
  // Before the greeting: "Hey! How are you?" wants an answer, not a hello back
  {
    test: /(how are you|how r u|what'?s up|как дела|как ты|как жизнь|чем занят)/i,
    en: [
      'All good, thanks! Just scrolling reels 😄 And you?',
      'Pretty good! Busy day though. You?',
      'Great! Just had coffee ☕',
    ],
    ru: [
      'Всё отлично, спасибо! Сижу листаю рилсы 😄 А ты?',
      'Нормально, день бешеный. Ты как?',
      'Хорошо! Только что выпила кофе ☕',
    ],
  },
  {
    test: /^(hi|hey|hello|yo|sup|привет|здравствуй|хай|ку|салам|добр)/i,
    en: ['Hey! 👋 How are you?', 'Hi hi! What is up?', 'Hello! 😊'],
    ru: ['Привет! 👋 Как дела?', 'Привет-привет! Как ты?', 'Хай! 😊'],
  },
  {
    test: /(thank|thx|спасибо|спс|благодар)/i,
    en: ['Anytime! ❤️', 'You are welcome 😊'],
    ru: ['Всегда пожалуйста! ❤️', 'Не за что 😊'],
  },
  {
    test: /(haha|lol|lmao|😂|🤣|ахах|хаха|лол|ржу)/i,
    en: ['😂😂', 'Haha exactly!', 'I can not 😂'],
    ru: ['😂😂', 'Ахаха, точно!', 'Не могу 😂'],
  },
  {
    test: /(love|❤|😍|люблю|обожаю|красив|класс)/i,
    en: ['❤️❤️', 'Aww thank you!', 'Same 😍'],
    ru: ['❤️❤️', 'Спасибо, очень приятно!', 'Взаимно 😍'],
  },
  {
    test: /(meet|coffee|tonight|weekend|встрет|кофе|вечером|выходн|погуля)/i,
    en: ['Yes! I am in 🙌', 'Sounds great, what time?', 'Saturday works for me ☕'],
    ru: ['Да! Я за 🙌', 'Отлично, во сколько?', 'В субботу могу ☕'],
  },
  {
    test: /(bye|good night|see you|пока|спокойной|до встречи|увидимся)/i,
    en: ['Bye! 👋', 'Good night 🌙', 'See you!'],
    ru: ['Пока! 👋', 'Спокойной ночи 🌙', 'До встречи!'],
  },
  {
    test: /\?$/,
    en: [
      'Hmm, good question 🤔',
      'I think so!',
      'Yes, definitely!',
      'Not sure yet, will let you know 😊',
    ],
    ru: ['Хм, хороший вопрос 🤔', 'Думаю, да!', 'Конечно!', 'Пока не знаю, напишу 😊'],
  },
];
const FALLBACK: Record<BotLang, string[]> = {
  en: [
    'Haha nice 😄',
    'Totally!',
    'Tell me more 👀',
    'Agreed!',
    'Sounds good 👍',
    'Omg really?',
    'That is awesome!',
  ],
  ru: [
    'Ахах, класс 😄',
    'Точно!',
    'Расскажи подробнее 👀',
    'Согласна!',
    'Звучит отлично 👍',
    'Серьёзно?',
    'Круто!',
  ],
};

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T;

/** A reply in the language the message was written in */
export function replyTo(text: string | null): string {
  const message = (text ?? '').trim();
  const lang: BotLang = /[а-яё]/i.test(message) ? 'ru' : 'en';
  const rule = RULES.find((r) => r.test.test(message));
  return pick(rule ? rule[lang] : FALLBACK[lang]);
}

export { pick };

/** What the demo audience writes under a live */
export const LIVE_COMMENTS: Record<BotLang, string[]> = {
  en: [
    'Hiii 👋',
    'Hello from Lisbon!',
    'Love this 😍',
    '🔥🔥🔥',
    'You look great!',
    'Where are you?',
    'First time catching your live!',
    '❤️❤️❤️',
    'Say hi to me pls 🙏',
    'This is so fun 😂',
    'Can you show the view?',
    'Greetings from Berlin 🇩🇪',
    'Haha 😂',
    'What song is this?',
    'Queen 👑',
    'Legend',
    'Yesss',
    '👏👏👏',
  ],
  ru: [
    'Приветики 👋',
    'Привет из Москвы!',
    'Обожаю 😍',
    '🔥🔥🔥',
    'Красота!',
    'Ты где?',
    'Первый раз на эфире!',
    '❤️❤️❤️',
    'Передай привет 🙏',
    'Ахаха 😂',
    'Покажи вид!',
    'Что за песня?',
    'Лучшая 👑',
    'Класс',
    'Ура, эфир!',
    '👏👏👏',
  ],
};
