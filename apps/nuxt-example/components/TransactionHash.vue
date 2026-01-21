<script setup lang="ts">
import { NetworkInfo, isMovementNetwork } from "@movement-labs/wallet-adapter-core";

interface TransactionHashProps {
  hash: string;
  network: NetworkInfo | null;
}

const props = defineProps<TransactionHashProps>();

const { hash, network } = toRefs(props);

const isMovementLink = computed(() => isMovementNetwork(network.value));

const explorerLink = computed(() => {
  if (isMovementLink.value) {
    return `https://explorer.movementlabs.xyz/txn/${hash.value}${
      network.value?.name ? `?network=${network.value?.name}` : ""
    }`;
  }
  return hash.value;
});
</script>

<template>
  <template v-if="isMovementLink">
    View on Explorer:
    <a
      :href="explorerLink"
      target="_blank"
      rel="noopener noreferrer"
      class="text-primary hover:underline"
    >
      {{ explorerLink }}
    </a>
  </template>
  <template v-else> Transaction Hash: {{ explorerLink }} </template>
</template>
