
export function createSelectFields(fields: string[]): Record<string, boolean> {
    const selectFields: Record<string, boolean> = {};
    fields.forEach(field => {
        selectFields[field] = true;
    });
    return selectFields;
}

//将二位数数组里的big int 转换为字符串
export function convertBigIntToJSON(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => convertBigIntToJSON(item));
    }
    const newObj: any = {};
    for (const key in obj) {
        if (typeof obj[key] === 'bigint') {
            newObj[key] = obj[key].toString();
        } else {
            newObj[key] = convertBigIntToJSON(obj[key]);
        }
    }
    return newObj;
}
