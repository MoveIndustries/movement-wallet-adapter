<script setup lang="ts">
import { Ref, toRefs, watch, unref } from "vue";
import {
  AdapterWallet,
  AdapterNotDetectedWallet,
  getMovementConnectWallets,
  partitionWallets,
  MovementPrivacyPolicy,
} from "@moveindustries/wallet-adapter-vue";

import { ChevronDown } from "lucide-vue-next";
import {
  CollapsibleRoot as Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "radix-vue";

interface Props {
  wallets: Ref<AdapterWallet[] | AdapterNotDetectedWallet[]>;
}

const props = defineProps<Props>();
const { wallets } = toRefs(props);
const emit = defineEmits(["close", "connect"]);
const walletsForConnect = ref({
  movementConnectWallets: [] as AdapterWallet[],
  defaultWallets: [] as AdapterWallet[],
  moreWallets: [] as AdapterNotDetectedWallet[],
});

watch(
  wallets,
  () => {
    const { movementConnectWallets, otherWallets } = getMovementConnectWallets(
      wallets.value
    );

    const { defaultWallets, moreWallets } = partitionWallets(otherWallets);

    walletsForConnect.value = {
      movementConnectWallets: unref(movementConnectWallets),
      defaultWallets: unref(defaultWallets),
      moreWallets: unref(moreWallets),
    };
  },
  {
    immediate: true,
    deep: true,
  }
);

function close() {
  emit("close");
}
</script>

<template>
  <DialogContent class="max-h-screen overflow-auto">
    <DialogHeader class="flex flex-col items-center">
      <DialogTitle class="flex flex-col text-center leading-snug">
        <span>Log in or sign up</span>
        <span>with Social + Movement Connect</span>
      </DialogTitle>
    </DialogHeader>
    <div class="flex flex-col gap-3 pt-3">
      <template v-for="wallet in walletsForConnect.movementConnectWallets">
        <MovementConnectWalletRow
          :wallet="wallet"
          @connect="$emit('connect', $event)"
          :onConnect="close"
        />
      </template>
    </div>
    <MovementPrivacyPolicy class="flex flex-col items-center">
    </MovementPrivacyPolicy>
    <div class="flex items-center gap-3 pt-4 text-muted-foreground">
      <div class="h-px w-full bg-secondary" />
      Or
      <div class="h-px w-full bg-secondary" />
    </div>
    <div class="flex flex-col gap-3 pt-3">
      <template
        v-for="wallet in walletsForConnect.defaultWallets"
        :key="wallet.name"
      >
        <WalletRow :wallet="wallet" @connect="$emit('connect', $event)" />
      </template>
      <template v-if="!!walletsForConnect.moreWallets.length">
        <Collapsible class="flex flex-col gap-3">
          <CollapsibleTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              class="gap-2 inline-flex items-center justify-center"
            >
              More wallets <ChevronDown />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent class="flex flex-col gap-3">
            <template
              v-for="wallet in walletsForConnect.moreWallets"
              :key="wallet.name"
            >
              <WalletRow :wallet="wallet" @connect="$emit('connect', $event)" />
            </template>
          </CollapsibleContent>
        </Collapsible>
      </template>
    </div>
  </DialogContent>
</template>
