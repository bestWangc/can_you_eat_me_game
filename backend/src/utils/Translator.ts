import _ from "lodash";

type Translations = {
	[key: string]: {
		en?: string; // 英文翻译
		[key: string]: string | undefined; // 其他语言的扩展
	};
};

export default class Translator {

	private translations: Translations = {
		'盲眼阿桃': {
			en: 'Blind starfruit',
		},
		'招财橙子': {
			en: 'Fortune orange',
		},
		'柠檬精': {
			en: 'Lemon essence',
		},
		'刺客蜜瓜': {
			en: 'Killer melon',
		},
		'元婴果': {
			en: 'Yuan Ying Fruit',
		},
		'西瓜大炮': {
			en: 'WM cannon',
		},
		'榴莲王': {
			en: 'Durian King',
		},
		'南瓜炸弹': {
			en: 'Pumpkin bomb',
		},
		'香蕉射手': {
			en: 'Banana shooter',
		},
		'爆头黄瓜': {
			en: 'Headshot cuke',
		},
		'辣破天': {
			en: 'Spicy heaven',
		},
		'冻斯梨': {
			en: 'Frozen pear',
		},
		'老巫蘑': {
			en: 'Witch mushroom',
		},
		'天山雪莲': {
			en: 'Ts Snow Lotus',
		},
		'盲眼阿桃会随机攻击一个目标': {
			en: 'Blind Starfruit will randomly attack a target!',
		},
		'元婴果的攻击会让目标流血': {
			en: 'The attack from the Yuan Ying Fruit will cause the target to bleed!',
		},
		'老巫蘑攻击会让敌人中毒，持续10秒': {
			en: "The Witch Mushroom's attack will poison enemies!",
		},
		'冻斯梨的攻击附带冰冻效果，使敌人移动速度减慢': {
			en: "Pear's attack comes with a freezing effect, slowing down enemies' speed!",
		},
		'南瓜炸弹会在路径上随机放置，触碰到敌人后发生爆炸': {
			en: "The Pumpkin Bomb will explode, dealing massive damage!",
		},
		'榴莲王每隔一段时间在道路上滚出，造成强大冲击，有概率击退目标': {
			en: "Durian King deals massive damage at regular intervals!",
		},
		'刺客蜜瓜命中同一目标伤害提升20%最多叠加5层': {
			en: "Attacking the same target increases attack speed over time!",
		},
		'香蕉射手会根据与敌人的距离获得伤害增幅': {
			en: "He’s a super marksman with high damage and fast attack speed!",
		},
		'天山雪莲对处于冰冻的敌人造成额外冰爆伤害': {
			en: "Deals extra ice explosion damage to frozen enemies!",
		},
		'爆头黄瓜会优先攻击首领并且对首领造成额外伤害': {
			en: "The Headshot Cucumber will prioritize attacking bosses!",
		},
		'西瓜大炮会在命中敌人后爆炸': {
			en: "The Watermelon cannon has launched a bomb",
		},
	};

	// 根据中文获取对应的翻译
	translate(text: string, lang: string): string {
		const translation = this.translations[text];
		if(_.isEmpty(translation) || _.isEmpty(translation[lang])){
			return text;
		}
		return translation[lang] || text;
	}
}
