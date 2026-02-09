"use client";

import { WalletModal } from "@moveindustries/wallet-adapter-move-design";
import { useWallet } from "@moveindustries/wallet-adapter-react";
import { useEffect, useRef, useState } from "react";

function reduceAddress(address: string | undefined) {
  if (!address) return "\u2026";
  try {
    return `${address.slice(0, 5)}\u2026${address.slice(-4)}`;
  } catch {
    return address;
  }
}

function WalletIcon({
  width = 24,
  height = 24,
  fill = "#002CD6",
}: {
  width?: number;
  height?: number;
  fill?: string;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M17.4845 4C17.7146 4 17.9357 4.09412 18.0984 4.26242C18.2611 4.43072 18.3521 4.65942 18.3521 4.89744V7.58974H19.2197V13.2308H17.4845V9.38462H11.4113C10.721 9.38462 10.0586 9.66797 9.57051 10.1729C9.08239 10.6778 8.80845 11.3629 8.80845 12.0769C8.80845 12.791 9.08239 13.4761 9.57051 13.981C10.0586 14.4859 10.721 14.7692 11.4113 14.7692H16.5085V16.5641H11.4113C10.2608 16.5641 9.1572 16.0915 8.34366 15.25C7.53012 14.4085 7.07324 13.267 7.07324 12.0769C7.07324 10.8868 7.53012 9.74536 8.34366 8.90385C9.1572 8.06234 10.2608 7.58974 11.4113 7.58974H16.6169V5.79487H2.73521V18.359H12.5684V20.239H1.8831C1.653 20.239 1.4319 20.1449 1.26919 19.9766C1.10648 19.8083 1.01549 19.5796 1.01549 19.3415L1 4.89744C1 4.65942 1.09099 4.43072 1.2537 4.26242C1.4164 4.09412 1.6375 4 1.86761 4H17.4845Z"
        fill={fill}
      />
      <path
        d="M19.2197 14.7692V16.5641H18.3521L18.3676 19.3415C18.3676 19.5796 18.2766 19.8083 18.1139 19.9766C17.9512 20.1449 17.7301 20.239 17.5 20.239H14.0141V18.359H17.5V14.7692H19.2197Z"
        fill={fill}
      />
      <path
        d="M14.0141 12.9744H11.4113V11.1795H14.0141V12.9744Z"
        fill={fill}
      />
      <path
        d="M19.2197 18.359H23V20.239H19.2197V24H17.5V20.239H14.0141V18.359H17.5V14.7692H19.2197V18.359Z"
        fill={fill}
      />
    </svg>
  );
}

function CaretDownIcon({
  size = 18,
  className,
  color = "currentColor",
}: {
  size?: number;
  className?: string;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 9L12 15L18 9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DisconnectIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoveIcon({ width = 10, height = 10 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="5" cy="5" r="5" fill="#81FFBA" />
      <path d="M3 5L5 3L7 5L5 7L3 5Z" fill="black" />
    </svg>
  );
}

function WalletOptionsDropdown({
  address,
  disconnect,
  onClose,
  triggerRef,
}: {
  address: string;
  disconnect: () => void;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isClickOutside =
        dropdownRef.current && !dropdownRef.current.contains(target);
      const isClickOnTrigger =
        triggerRef?.current && triggerRef.current.contains(target);
      if (isClickOutside && !isClickOnTrigger) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, triggerRef]);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
  };

  return (
    <div className="z-9999 relative">
      <div
        ref={dropdownRef}
        className="absolute top-[calc(100%+8px)] right-0 w-48 rounded-lg border border-white/10 bg-black/95 backdrop-blur-xl overflow-visible"
      >
        <div className="flex items-center gap-2 px-3 h-10 rounded text-[#81FFBA] font-['TWK_Everett_Mono',monospace] text-sm font-medium leading-[140%] hover:bg-white/5">
          <WalletIcon width={14} height={14} fill="#81FFBA" />
          <span className="flex-1">{reduceAddress(address)}</span>
          <button onClick={copyAddress} className="cursor-pointer border-none bg-transparent p-0">
            <CopyIcon size={14} color="#81FFBA" />
          </button>
        </div>
        <div
          className="group flex cursor-pointer items-center gap-2 rounded-b px-3 py-3.5 h-10 text-white/64 hover:bg-[#81FFBA] hover:text-[#00135C]"
          onClick={disconnect}
        >
          <DisconnectIcon size={16} />
          <span>disconnect</span>
        </div>
      </div>
    </div>
  );
}

export function MoveDesignWalletSelector() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { connected, disconnect, account, wallet } = useWallet();
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-10 w-40 min-w-24 rounded-full bg-white/8 md:h-12">
        <div className="pointer-events-none inset-0 -z-hide h-full w-full animate-pulse overflow-hidden rounded-[inherit] bg-linear-to-r from-white/5 via-white/10 to-white/5 bg-[length:200%_100%]" />
      </div>
    );
  }

  if (!connected) {
    return (
      <>
        <button
          className="group relative flex h-10 w-40 min-w-24 cursor-pointer items-center justify-center gap-1 overflow-hidden rounded-full border-none p-0 text-[#002CD6] transition-all duration-200 group-hover:text-black md:h-12"
          style={{
            background:
              "linear-gradient(130deg, #81FFBA 33.64%, #00FFF9 79.2%)",
          }}
          onClick={() => setIsModalOpen(true)}
        >
          <div className="absolute inset-0 rounded-full bg-white opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          <div className="relative z-10 flex items-center justify-center gap-1">
            <WalletIcon width={20} height={20} fill="currentColor" />
            <span className="hidden items-center font-['TWK_Everett_Mono',monospace] text-base leading-[1.3rem] font-medium md:flex">
              CONNECT
            </span>
          </div>
        </button>
        {isModalOpen && (
          <WalletModal onClose={() => setIsModalOpen(false)} />
        )}
      </>
    );
  }

  const address = account?.address?.toString() || "";

  return (
    <div className="relative inline-block">
      <button
        ref={triggerButtonRef}
        className="group flex h-10 w-24 cursor-pointer items-center justify-center gap-1 rounded-full border-none bg-white/8 pl-0 pr-0 text-white/64 transition-all duration-200 hover:bg-white hover:text-black md:h-12 md:w-50 md:pl-4 md:pr-4"
        onClick={() => setShowDropdown(!showDropdown)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative group-hover:[&_svg]:text-black">
          {wallet?.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={wallet.icon}
              alt="Wallet"
              width={20}
              height={20}
              className="transition-all duration-200"
            />
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              className="text-white"
            >
              <path
                d="M21 18V19C21 20.1 20.1 21 19 21H5C3.89 21 3 20.1 3 19V5C3 3.9 3.89 3 5 3H19C20.1 3 21 3.9 21 5V6H12C10.89 6 10 6.9 10 8V16C10 17.1 10.89 18 12 18H21ZM12 16H22V8H12V16ZM16 13.5C15.17 13.5 14.5 12.83 14.5 12C14.5 11.17 15.17 10.5 16 10.5C16.83 10.5 17.5 11.17 17.5 12C17.5 12.83 16.83 13.5 16 13.5Z"
                fill="currentColor"
              />
            </svg>
          )}
          <div className="absolute -right-1 -bottom-1 rounded-full bg-black transition-all duration-200">
            <MoveIcon width={10} height={10} />
          </div>
        </div>

        <span className="hidden max-w-[120px] truncate font-['Neue_Haas_Unica_Pro',sans-serif] text-sm leading-[1.225rem] font-medium md:block">
          {reduceAddress(address)}
        </span>

        <CaretDownIcon
          size={18}
          className={`transition-transform duration-200 ${showDropdown ? "rotate-180" : ""}`}
          color={isHovered ? "black" : "rgba(255, 255, 255, 0.64)"}
        />
      </button>
      {showDropdown && (
        <WalletOptionsDropdown
          address={address}
          onClose={() => setShowDropdown(false)}
          disconnect={() => {
            disconnect();
            setShowDropdown(false);
          }}
          triggerRef={triggerButtonRef}
        />
      )}
    </div>
  );
}
