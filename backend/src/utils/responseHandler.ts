import { Response } from 'express';

// 定义响应结构接口
interface ApiResponse<T = unknown> {
  code: number;
  msg: string;
  data?: T;
}

// 通用响应函数
const sendResponse = <T>(res: Response, code: number, msg: string, data?: T) => {
  res.json({ code, msg, data });
};

// 成功响应
export const successRes = <T>(res: Response, data: T, msg: string = "success", code: number = 200) => {
  sendResponse(res, code, msg, data);
};

// 失败响应
export const errorRes = (res: Response, msg: string = "fail", code: number = 500) => {
  sendResponse(res, code, msg);
};