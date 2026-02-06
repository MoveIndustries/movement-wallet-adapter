import {
  Movement,
  MovementConfig,
  InputSubmitTransactionData,
  PendingTransactionResponse,
  TransactionSubmitter,
} from "@moveindustries/ts-sdk";

/**
 * This is a dummy transaction submitter that just logs the transaction and then
 * submits it normally.
 */
class MyTransactionSubmitter implements TransactionSubmitter {
  submitTransaction(
    args: { movementConfig: MovementConfig } & Omit<
      InputSubmitTransactionData,
      "transactionSubmitter"
    >,
  ): Promise<PendingTransactionResponse> {
    const { movementConfig } = args;
    console.log("Submitting transaction with MyTransactionSubmitter", args);
    const aptos = new Movement(movementConfig);
    return aptos.transaction.submit.simple({
      ...args,
      // We do this so we don't recurse back to this function but instead use the
      // proper regular txn submitter.
      transactionSubmitter: null,
    });
  }
}

export const myTransactionSubmitter = new MyTransactionSubmitter();
