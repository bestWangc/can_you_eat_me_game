import { toNano } from '@ton/core';
import { EatMe } from '../wrappers/EatMe';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const eatMe = provider.open(await EatMe.fromInit());

    await eatMe.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(eatMe.address);

    // run methods on `eatMe`
}
