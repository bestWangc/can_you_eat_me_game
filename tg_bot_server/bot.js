"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const grammy_1 = require("grammy");
const dotenv_1 = __importDefault(require("dotenv"));
const sutando_1 = require("sutando");
// 加载 .env 文件中的环境变量
dotenv_1.default.config();
sutando_1.sutando.addConnection({
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE
    },
});
// 设置代理
// const proxyUrl: string = process.env.proxyUrl as string;
// const agent = new HttpsProxyAgent(proxyUrl);
const bot = new grammy_1.Bot(process.env.tgToken, {
    client: {
        baseFetchConfig: {
            // agent: agent,
            compress: true,
        }
    }
});
// 你现在可以在你的 bot 对象 `bot` 上注册监听器。
// 当用户向你的 bot 发送消息时，grammY 将调用已注册的监听器。
// bot.on("callback_query:game_short_name", async (ctx) => {
//     const userId = ctx.from?.id; // 获取用户ID
//     const username = ctx.from?.username;
//     const userInfo = "\nUser id: " + userId + "\nUser name: " + username + "\n\n";
//     console.log(userInfo);
//     await ctx.answerCallbackQuery({ url: `https://eatme.fun` });
// });
// 处理 /start 命令。
bot.command("start", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    console.log("start deal");
    console.log(ctx.from);
    const userId = (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id;
    const username = (_b = ctx.from) === null || _b === void 0 ? void 0 : _b.username;
    //成员操作
    memberHandler(userId, username);
    const mainMenuMarkup = new grammy_1.InlineKeyboard();
    // const userInfo="\nUser id: "+userId+"\nUser name: "+username;
    // 添加 Mini Web App 按钮到主菜单
    mainMenuMarkup.webApp("Play Now", "https://eatme.fun");
    // mainMenuMarkup.text("My Points", "CHECK_POINTS");
    // mainMenuMarkup.text("Gift Cards", "CHECK_GIFTCARDS");
    yield ctx.replyWithPhoto('https://eatme.fun/eatme.png', {
        // caption: "<b>Welcome to our game</b>\n"+userInfo,
        caption: "<b>Stinky zombie, stop hitting A Tao! Come quickly to protect A Tao!</b>\n",
        parse_mode: "HTML",
        reply_markup: mainMenuMarkup,
    });
    // await ctx.replyWithGame("eatMeeeee");
}));
function memberHandler(userId, username) {
    return __awaiter(this, void 0, void 0, function* () {
        const db = sutando_1.sutando.connection();
        console.log(username);
        const user = yield db.table('users').where('telegram_id', userId).first();
        console.log(user);
        if (user) {
            console.log("user exist");
            return;
        }
        console.log("user not exist");
        //新增用户
        const inviteCode = generateUniqueInviteCode();
        yield db.table('users').insert({
            telegram_id: userId,
            username: username,
            create_time: Math.floor(Date.now() / 1000),
            invite_code: inviteCode
        });
        return true;
    });
}
function generateUniqueInviteCode(length = 8) {
    let inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    return inviteCode;
}
// 现在，你已经确定了将如何处理信息，可以开始运行你的 bot。
// 这将连接到 Telegram 服务器并等待消息。
// 启动 bot。
bot.start();
bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof grammy_1.GrammyError) {
        console.error("Error in request:", e.description);
    }
    else if (e instanceof grammy_1.HttpError) {
        console.error("Could not contact Telegram:", e);
    }
    else {
        console.error("Unknown error:", e);
    }
});
