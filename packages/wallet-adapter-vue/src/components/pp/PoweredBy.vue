<script setup lang="ts">
import MovementLogo from "../icons/MovementLogo.vue";
</script>

<template>
  <div v-bind="$attrs">
    <span>Powered by</span>
    <MovementLogo />
    <span>Movement Labs</span>
  </div>
</template>
