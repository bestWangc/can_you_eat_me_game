import { CompilerConfig } from '@ton/blueprint';

export const compile: CompilerConfig = {
    lang: 'tact',
    target: 'contracts/eat_me.tact',
    options: {
        debug: true,
    },
};
