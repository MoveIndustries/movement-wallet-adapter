<script setup lang="ts">
import { useWallet } from "@moveindustries/wallet-adapter-vue";
import { useToast } from "~/components/ui/toast";

const { $dappConfig } = useNuxtApp();
const { toast } = useToast();

const handleError = (error: any) => {
  toast({
    variant: "destructive",
    title: "Error",
    description: error || "Unknown wallet error",
  });
};

const walletAdapter = useWallet({
  dappConfig: $dappConfig,
  onError: handleError,
});

// Provide wallet adapter to Vue inject/provide system
provide('walletAdapter', walletAdapter);
</script>

<template>
  <slot />
</template>
