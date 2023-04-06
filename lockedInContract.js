// @ts-check
import { Far } from '@endo/marshal';
import '@agoric/zoe/exported.js';

const start = async zcf => {

  const { zcfSeat: internalSeat } = zcf.makeEmptySeatKit();

  const shutdown = seat => {
    zcf.shutdown('contract expired');
  };

  const deposit = seat => {
    internalSeat.incrementBy(
      seat.decrementBy(harden(seat.getCurrentAllocation())),
    );
    zcf.reallocate(internalSeat, seat);
    seat.exit();
    return 'added to internalSeat';
  }

  const getCurrentAllocation = () => {
    return internalSeat.getCurrentAllocation();
  }

  const creatorFacet = Far('creatorFacet', {
    makeShutdownInvitation: () => zcf.makeInvitation(shutdown, 'shutdown'),
    makeDepositInvitation: () => zcf.makeInvitation(deposit, 'deposit'),
    getAllocation: getCurrentAllocation
  });

  return harden({ creatorFacet });
};

harden(start);
export { start };
