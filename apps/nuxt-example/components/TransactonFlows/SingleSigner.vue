<script setup lang="ts">
import { computed, h } from "vue";
import { movementClient, isSendableNetwork } from "@/utils";
import { AccountAddress, parseTypeTag, U64 } from "@moveindustries/ts-sdk";
import { InputTransactionData } from "@moveindustries/wallet-adapter-core";
import TransactionHash from "~/components/TransactionHash.vue";
import { useToast } from "~/components/ui/toast";
const { toast } = useToast();
const { $walletAdapter } = useNuxtApp();
const {
  network,
  connected,
  account,
  signAndSubmitTransaction,
  signMessageAndVerify,
  signMessage,
  signTransaction,
} = $walletAdapter;

const MOVEMENT_COIN = "0x1::aptos_coin::AptosCoin";

const isSendable = computed(() =>
  isSendableNetwork(connected.value, network.value?.name || undefined),
);

const onSignMessageAndVerify = async () => {
  const payload = {
    message: "Hello from Movement Wallet Adapter",
    nonce: Math.random().toString(16),
  };
  const response = await signMessageAndVerify(payload);
  toast({
    title: "Success",
    description: JSON.stringify({ onSignMessageAndVerify: response }),
  });
};

const onSignMessage = async () => {
  const payload = {
    message: "Hello from Movement Wallet Adapter",
    nonce: Math.random().toString(16),
  };
  const response = await signMessage(payload);
  toast({
    title: "Success",
    description: JSON.stringify({ onSignMessage: response }),
  });
};

const onSignAndSubmitTransaction = async () => {
  if (!account) return;
  const transaction: InputTransactionData = {
    data: {
      function: "0x1::coin::transfer",
      typeArguments: [MOVEMENT_COIN],
      functionArguments: [account.value?.address.toString(), 1], // 1 is in Octas
    },
  };
  try {
    const response = await signAndSubmitTransaction(transaction);
    await movementClient(network.value).waitForTransaction({
      transactionHash: response.hash,
    });
    toast({
      title: "Success",
      description: h(TransactionHash, {
        hash: response.hash,
        network: network.value,
      }),
    });
  } catch (error) {
    console.error(error);
  }
};

const onSignAndSubmitBCSTransaction = async () => {
  if (!account.value) return;

  try {
    const response = await signAndSubmitTransaction({
      data: {
        function: "0x1::coin::transfer",
        typeArguments: [parseTypeTag(MOVEMENT_COIN)],
        functionArguments: [
          AccountAddress.from(account.value?.address),
          new U64(1),
        ], // 1 is in Octas
      },
    });
    await movementClient(network.value).waitForTransaction({
      transactionHash: response.hash,
    });
    toast({
      title: "Success",
      description: h(TransactionHash, {
        hash: response.hash,
        network: network.value,
      }),
    });
  } catch (error) {
    console.error(error);
  }
};

// Legacy typescript sdk support
const onSignTransaction = async () => {
  try {
    const payload = {
      type: "entry_function_payload",
      function: "0x1::coin::transfer",
      type_arguments: ["0x1::aptos_coin::AptosCoin"],
      arguments: [account.value?.address.toString(), 1], // 1 is in Octas
    };
    const response = await signTransaction(payload);
    toast({
      title: "Success",
      description: JSON.stringify(response),
    });
  } catch (error) {
    console.error(error);
  }
};

const onSignTransactionV2 = async () => {
  if (!account.value) return;

  try {
    const transactionToSign = await movementClient(
      network.value,
    ).transaction.build.simple({
      sender: account.value?.address,
      data: {
        function: "0x1::coin::transfer",
        typeArguments: [MOVEMENT_COIN],
        functionArguments: [account.value?.address.toString(), 1], // 1 is in Octas
      },
    });
    const response = await signTransaction(transactionToSign);
    toast({
      title: "Success",
      description: JSON.stringify(response),
    });
  } catch (error) {
    console.error(error);
  }
};
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Single Signer Flow</CardTitle>
    </CardHeader>
    <CardContent class="flex flex-wrap gap-4">
      <Button @click="onSignAndSubmitTransaction" :disabled="!isSendable">
        Sign and submit transaction
      </Button>
      <Button @click="onSignAndSubmitBCSTransaction" :disabled="!isSendable">
        Sign and submit BCS transaction
      </Button>
      <Button @click="onSignTransaction" :disabled="!isSendable">
        Sign transaction
      </Button>
      <Button @click="onSignTransactionV2" :disabled="!isSendable">
        Sign transaction V2
      </Button>
      <Button @click="onSignMessage" :disabled="!isSendable">
        Sign message
      </Button>
      <Button @click="onSignMessageAndVerify" :disabled="!isSendable">
        Sign message and verify
      </Button>
    </CardContent>
  </Card>
</template>
