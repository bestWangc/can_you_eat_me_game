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
			en: 'Blind Starfruit will randomly attack a target',
		},
		'元婴果的攻击会让目标流血': {
			en: 'The attack from the Yuan Ying Fruit will cause the target to bleed',
		},
		'老巫蘑攻击会让敌人中毒，持续10秒': {
			en: "The Witch Mushroom's attack will poison enemies",
		},
		'冻斯梨的攻击附带冰冻效果，使敌人移动速度减慢': {
			en: "Pear's attack comes with a freezing effect, slowing down enemies' speed",
		},
		'南瓜炸弹会在路径上随机放置，触碰到敌人后发生爆炸': {
			en: "The Pumpkin Bomb will explode, dealing massive damage",
		},
		'榴莲王每隔一段时间在道路上滚出，造成强大冲击，有概率击退目标': {
			en: "Durian King deals massive damage at regular intervals",
		},
		'刺客蜜瓜命中同一目标伤害提升20%最多叠加5层': {
			en: "Attacking the same target increases attack speed over time",
		},
		'香蕉射手会根据与敌人的距离获得伤害增幅': {
			en: "He’s a super marksman with high damage and fast attack speed",
		},
		'天山雪莲对处于冰冻的敌人造成额外冰爆伤害': {
			en: "Deals extra ice explosion damage to frozen enemies",
		},
		'爆头黄瓜会优先攻击首领并且对首领造成额外伤害': {
			en: "The Headshot Cucumber will prioritize attacking bosses",
		},
		'西瓜大炮会在命中敌人后爆炸': {
			en: "The Watermelon cannon has launched a bomb",
		},

		'蒸桑拿之地': {
			en: "Sauna place",
		},
		'高级桑拿之地': {
			en: "Premium sauna place",
		},
		'捞死鱼之海': {
			en: "Fishing Dead Sea",
		},
		'海王集中营': {
			en: "Aquaman's concentration camp",
		},
		'打野王丛林': {
			en: "Jungle King",
		},
		'高级打野丛林': {
			en: "Advanced Jungle",
		},
		'一片绿草原': {
			en: "A vast green meadow",
		},
		'整片绿草原': {
			en: "A whole green prairie",
		},
		'荒漠部落': {
			en: "Desert tribe!",
		},
		'荒漠风暴': {
			en: "Desert storm",
		},
		'无妄之海': {
			en: "The Sea of ​​Nothingness",
		},
		'不尽死海': {
			en: "The endless Dead Sea",
		},
		'暗黑丛林': {
			en: "Dark Jungle",
		},
		'丛林深处': {
			en: "Jungle Deep",
		},
		'平原咆哮': {
			en: "Roar of the plains",
		},
		'平原禁地': {
			en: "The forbidden plains",
		},

		'攻击力+X%': {
			en: "Attack power +X%",
		},
		'攻击速度+X%': {
			en: "Attack speed +X%",
		},
		'暴击率+X%': {
			en: "Critical hit rate +X%",
		},
		'暴击伤害+X%': {
			en: "Critical damage +X%",
		},

		'所有水果攻击力+X%': {
			en: "All fruit' attack power +X%",
		},
		'所有水果攻速+X%': {
			en: "All fruit' attack speed +X%",
		},
		'所有水果暴击率+X%': {
			en: "All fruit' critical hit rate +X%",
		},
		'所有水果暴击伤害+X%': {
			en: "All fruit' critical damage +X%",
		},
		'立即获得X银币': {
			en: "Get X silver coins now",
		},
		'每波获得银币+X': {
			en: "Get silver coins +X per wave",
		},
		'所有敌人移动速度-X%': {
			en: "All monsters' move speed -X%",
		},
		'商店下次额外刷新一个2级水果': {
			en: "The shop will refresh an extra level 2 fruit next time",
		},
		'杨桃的暴击几率+X%': {
			en: "Blind starfruit' critical hit rate +X%",
		},
		'杨桃的攻击速度+X%': {
			en: "Blind starfruit' attack speed +X%",
		},
		'杨桃的暴击伤害+X%': {
			en: "Blind starfruit' critical damage +X%",
		},
		'哈密瓜攻击力+X%': {
			en: "Killer melon' attack power +X%",
		},
		'哈密瓜攻击速度+X%': {
			en: "Killer melon' attack speed +X%",
		},
		'哈密瓜暴击率+X%': {
			en: "Killer melon' critical hit rate +X%",
		},
		'哈密瓜暴击伤害+X%': {
			en: "Killer melon' critical damage +X%",
		},
		'樱桃的攻击会让目标流血': {
			en: "Yuan Ying Fruit' attacks will cause bleed",
		},
		'流血伤害+X%': {
			en: "Bleeding damage +X%",
		},
		'元婴果攻击力+X%': {
			en: "Yuan Ying Fruit' attack power +X%",
		},
		'元婴果暴击率+X%': {
			en: "Yuan Ying Fruit' critical hit rate +X%",
		},
		'西瓜暴击率+X%': {
			en: "WM cannon' critical hit rate +X%",
		},
		'西瓜暴击伤害+X%': {
			en: "WM cannon' critical damage +X%",
		},
		'西瓜攻击力+X%': {
			en: "WM cannon' attack power +X%",
		},
		'榴莲暴击率+X%': {
			en: "Durian King' critical hit rate +X%",
		},
		'榴莲暴击伤害+X%': {
			en: "Durian King' critical damage +X%",
		},
		'南瓜攻击力+X%': {
			en: "Pumpkin bomb' attack power +X%",
		},
		'南瓜暴击率+X%': {
			en: "Pumpkin bomb' critical hit rate +X%",
		},
		'南瓜攻击速度+X%': {
			en: "Pumpkin bomb' attack speed +X%",
		},
		'额外造成怪物当前生命值X%伤害': {
			en: "Deal an additional X% of the monster's current health as damage",
		},
		'香蕉每次攻击提升X%攻速，可叠加15层': {
			en: "Banana shooter' increases attack speed by X% each time it attacks, 5 layers in total",
		},
		'香蕉攻击力+X%': {
			en: "Banana shooter' attack power +X%",
		},
		'香蕉攻击速度+X%': {
			en: "Banana shooter' attack speed +X%",
		},
		'香蕉暴击率+X%': {
			en: "Banana shooter' critical hit rate +X%",
		},
		'香蕉暴击伤害+X%': {
			en: "Banana shooter' critical damage +X%",
		},
		'黄瓜攻击力+X%': {
			en: "Headshot cuke' attack power +X%",
		},
		'黄瓜暴击伤害+X%': {
			en: "Headshot cuke' critical damage +X%",
		},
		'黄瓜暴击率+X%': {
			en: "Headshot cuke' critical hit rate +X%",
		},
		'黄瓜攻击速度+X%': {
			en: "Headshot cuke' attack speed +X%",
		},
		'冻梨的攻击速度+X%': {
			en: "Headshot cuke' attack speed +X%",
		},
		'冻梨的攻击力+X%': {
			en: "Headshot cuke' attack power +X%",
		},
		'蘑菇的攻击让敌人中毒': {
			en: "Witch mushroom' attacks will poison the monster",
		},
		'蘑菇的攻击速度+X%': {
			en: "Witch mushroom' attack speed +X%",
		},
		'中毒伤害+X': {
			en: "Poison damage +X",
		},
		'蘑菇的攻击力+X%': {
			en: "Witch mushroom' attack power +X%",
		},
		'天山雪莲暴击率+X%': {
			en: "Ts Snow Lotus' critical hit rate +X%",
		},
		'天山雪莲暴击伤害+X%': {
			en: "Ts Snow Lotus' critical damage +X%",
		},
		'杨桃会攻击2个敌人': {
			en: "Blind starfruit' will attack 2 monsters",
		},
		'元婴果会分裂，同时攻击3个敌人': {
			en: "Yuan Ying fruit' will split and attack 3 monsters at the same time",
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
