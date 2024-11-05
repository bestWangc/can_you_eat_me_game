import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { EatMe } from '../wrappers/EatMe';
import '@ton/test-utils';

describe('EatMe', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let eatMe: SandboxContract<EatMe>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        eatMe = blockchain.openContract(await EatMe.fromInit());

        deployer = await blockchain.treasury('deployer');

        const deployResult = await eatMe.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: eatMe.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and eatMe are ready to use
    });
});
