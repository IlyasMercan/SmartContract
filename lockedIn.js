// @ts-check

/* eslint-disable import/order -- https://github.com/endojs/endo/issues/1235 */
import { test } from './prepare-test-env-ava.js';
import path from 'path';

import bundleSource from '@endo/bundle-source';

import { E } from '@endo/eventual-send';
import { makeFakeVatAdmin } from '@agoric/zoe/tools/fakeVatAdmin.js';
import { makeZoeKit } from '@agoric/zoe';
import { AmountMath, AssetKind, makeIssuerKit } from '@agoric/ertp';

const filename = new URL(import.meta.url).pathname;
const dirname = path.dirname(filename);

test('locked in', async (t) => {
    const contractPath = `${dirname}/../src/lockedInContract.js`;
    
    //create a fake vat admin
    const { admin: fakeVatAdmin, vatAdminState } = makeFakeVatAdmin();
  
    //instantiate Zoe
    const { zoeService: zoe } = makeZoeKit(fakeVatAdmin);
  
    //the smart contract is installed on Zoe
    const bundle = await bundleSource(contractPath);
    vatAdminState.installBundle('b1-lockedIn',bundle);
    const installation = await E(zoe).installBundleID('b1-lockedIn');
  
    //2 currency is created
    const alphaCoin = makeIssuerKit("AlphaCoin");
    const betaCoin = makeIssuerKit("AlphaCoin");
  
    //Alice gets an AlphaCoin purse
    const alphaCoinPurseAlice = await E(alphaCoin.issuer).makeEmptyPurse();
  
    //Alice gets 1000 tokens in her purse
    alphaCoinPurseAlice.deposit(alphaCoin.mint.mintPayment(AmountMath.make(alphaCoin.brand, 1000n)));
  
    //Alice starts an instance of the installation
    const { creatorFacet } = await zoe.startInstance(installation, {
      Asset: alphaCoin.issuer,
      Price: betaCoin.issuer,
    });

    //Alice stores assets on the internal seat
    const depositInvitationAlice = await E(creatorFacet).makeDepositInvitation();

    //Alice states that she wants to add 250 AlphaCoins to the internalSeat
    const depositProposalAlice = harden({
      give: { Asset: AmountMath.make(alphaCoin.brand, 250n) },
      exit: { onDemand : null}
    });

    //Alice gets these coins out of her purse, and collects them in a payment
    const depositPaymentsAlice = {
      Asset: alphaCoinPurseAlice.withdraw(AmountMath.make(alphaCoin.brand, 250n)),
    };

    const aliceSeatDeposit = await E(zoe).offer(depositInvitationAlice, depositProposalAlice, depositPaymentsAlice)

    //there should not have been any payout to the aliceSeatDeposit
    //Alice adds the payout to her purse
    await E(aliceSeatDeposit).getPayout('Asset').then(payment => alphaCoinPurseAlice.deposit(payment));

    //Verification that no payout has happened: Alice should have 1000-250=750 AlphaCoins
    t.deepEqual(alphaCoinPurseAlice.getCurrentAmount(), AmountMath.make(alphaCoin.brand, 750n));

    //The internal seat should have 250 AlphaCoins
    t.deepEqual(
      (await E(creatorFacet).getAllocation()).Asset.value,
      250n
    );

    //Alice shuts down the smart contract
    const shutDownInvitation = await E(creatorFacet).makeShutdownInvitation();
    const aliceShutdownSeat = await E(zoe).offer(shutDownInvitation);

    //We ensure that Alice did not get any money back
    
    //can't get payout from deposit seat: this payment is used up
    //await E(aliceSeatDeposit).getPayout('Asset').then(payment => alphaCoinPurseAlice.deposit(payment));
    
    //there are no payouts in the aliceShutdownSeat
    t.deepEqual(await E(aliceShutdownSeat).getPayouts(), {});
    t.deepEqual(alphaCoinPurseAlice.getCurrentAmount(), AmountMath.make(alphaCoin.brand, 750n));

    //so: where did the 250 AlphaCoins go?
});
