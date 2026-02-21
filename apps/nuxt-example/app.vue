<script setup lang="ts">
import Toaster from "@/components/ui/toast/Toaster.vue";
import { registerWallet } from "./utils/standardWallet";

onBeforeMount(() => {
  registerWallet();
});
</script>
<template>
  <Toaster />
  <ClientOnly>
    <WalletProvider>
      <NuxtLayout name="default">
        <NuxtPage />
      </NuxtLayout>
    </WalletProvider>
  </ClientOnly>
</template>
