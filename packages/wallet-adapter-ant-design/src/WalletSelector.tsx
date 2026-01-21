import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CopyOutlined,
  DisconnectOutlined,
} from "@ant-design/icons";
import {
  AboutMovementConnect,
  AboutMovementConnectEducationScreen,
  AdapterNotDetectedWallet,
  AdapterWallet,
  MovementPrivacyPolicy,
  WalletItem,
  WalletSortingOptions,
  groupAndSortWallets,
  isInstallRequired,
  truncateAddress,
  useWallet,
} from "@movement-labs/wallet-adapter-react";
import {
  Button,
  Collapse,
  Divider,
  Dropdown,
  Flex,
  MenuProps,
  Modal,
  ModalProps,
  Typography,
  message,
} from "antd";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import "./styles.css";

const { Text } = Typography;

interface WalletSelectorProps extends WalletSortingOptions {
  isModalOpen?: boolean;
  setModalOpen?: Dispatch<SetStateAction<boolean>>;
}

export function WalletSelector({
  isModalOpen,
  setModalOpen,
  ...walletSortingOptions
}: WalletSelectorProps) {
  const [walletSelectorModalOpen, setWalletSelectorModalOpen] = useState(false);

  useEffect(() => {
    // If the component is being used as a controlled component,
    // sync the external and internal modal state.
    if (isModalOpen !== undefined) {
      setWalletSelectorModalOpen(isModalOpen);
    }
  }, [isModalOpen]);

  const {
    account,
    connected,
    disconnect,
    wallets = [],
    notDetectedWallets = [],
  } = useWallet();

  const { movementConnectWallets, availableWallets, installableWallets } =
    groupAndSortWallets(
      [...wallets, ...notDetectedWallets],
      walletSortingOptions,
    );

  const hasMovementConnectWallets = !!movementConnectWallets.length;

  const onWalletButtonClick = () => {
    if (connected) {
      disconnect();
    } else {
      setWalletSelectorModalOpen(true);
    }
  };

  const handleCopyAddress = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address.toString());
      message.success("Address copied to clipboard");
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const dropdownItems: MenuProps["items"] = [
    {
      key: "copy",
      label: "Copy Address",
      icon: <CopyOutlined />,
      onClick: handleCopyAddress,
    },
    {
      key: "disconnect",
      label: "Disconnect",
      icon: <DisconnectOutlined />,
      onClick: handleDisconnect,
    },
  ];

  const closeModal = () => {
    setWalletSelectorModalOpen(false);
    if (setModalOpen) {
      setModalOpen(false);
    }
  };

  const buttonText =
    account?.ansName ||
    truncateAddress(account?.address?.toString()) ||
    "Unknown";

  const modalProps: ModalProps = {
    centered: true,
    open: walletSelectorModalOpen,
    onCancel: closeModal,
    footer: null,
    zIndex: 9999,
    className: "wallet-selector-modal",
  };

  const renderEducationScreens = (screen: AboutMovementConnectEducationScreen) => (
    <Modal
      {...modalProps}
      afterClose={screen.cancel}
      title={
        <div className="about-movement-connect-header">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={screen.cancel}
          />
          <div className="wallet-modal-title">About Petra Web</div>
        </div>
      }
    >
      <div className="about-movement-connect-graphic-wrapper">
        <screen.Graphic />
      </div>
      <div className="about-movement-connect-text-wrapper">
        <screen.Title className="about-movement-connect-title" />
        <screen.Description className="about-movement-connect-description" />
      </div>
      <div className="about-movement-connect-footer-wrapper">
        <Button
          type="text"
          style={{ justifySelf: "start" }}
          onClick={screen.back}
        >
          Back
        </Button>
        <div className="about-movement-connect-screen-indicators-wrapper">
          {screen.screenIndicators.map((ScreenIndicator, i) => (
            <ScreenIndicator
              key={i}
              className="about-movement-connect-screen-indicator"
            >
              <div />
            </ScreenIndicator>
          ))}
        </div>
        <Button
          type="text"
          icon={<ArrowRightOutlined />}
          iconPosition="end"
          style={{ justifySelf: "end" }}
          onClick={screen.next}
        >
          {screen.screenIndex === screen.totalScreens - 1 ? "Finish" : "Next"}
        </Button>
      </div>
    </Modal>
  );

  return (
    <>
      {connected ? (
        <Dropdown menu={{ items: dropdownItems }} trigger={["click"]}>
          <Button className="wallet-button">{buttonText}</Button>
        </Dropdown>
      ) : (
        <Button className="wallet-button" onClick={onWalletButtonClick}>
          Connect Wallet
        </Button>
      )}
      <AboutMovementConnect renderEducationScreen={renderEducationScreens}>
        <Modal
          {...modalProps}
          title={
            <div className="wallet-modal-title">
              {hasMovementConnectWallets ? (
                <>
                  <span>Log in or sign up</span>
                  <span>with Social + Petra Web</span>
                </>
              ) : (
                "Connect Wallet"
              )}
            </div>
          }
        >
          {!connected && (
            <>
              {hasMovementConnectWallets && (
                <Flex vertical gap={12}>
                  {movementConnectWallets.map((wallet) => (
                    <MovementConnectWalletRow
                      key={wallet.name}
                      wallet={wallet}
                      onConnect={closeModal}
                    />
                  ))}
                  <p className="about-movement-connect-trigger-wrapper">
                    Learn more about{" "}
                    <AboutMovementConnect.Trigger className="about-movement-connect-trigger">
                      Petra Web
                      <ArrowRightOutlined />
                    </AboutMovementConnect.Trigger>
                  </p>
                  <MovementPrivacyPolicy className="movement-connect-privacy-policy-wrapper">
                    <p className="movement-connect-privacy-policy-text">
                      <MovementPrivacyPolicy.Disclaimer />{" "}
                      <MovementPrivacyPolicy.Link className="movement-connect-privacy-policy-link" />
                      <span>.</span>
                    </p>
                    <MovementPrivacyPolicy.PoweredBy className="movement-connect-powered-by" />
                  </MovementPrivacyPolicy>
                  <Divider>Or</Divider>
                </Flex>
              )}
              <Flex vertical gap={12}>
                {availableWallets.map((wallet) => (
                  <WalletRow
                    key={wallet.name}
                    wallet={wallet}
                    onConnect={closeModal}
                  />
                ))}
              </Flex>
              {!!installableWallets.length && (
                <Collapse
                  ghost
                  expandIconPosition="end"
                  items={[
                    {
                      key: "more-wallets",
                      label: "More Wallets",
                      children: (
                        <Flex vertical gap={12}>
                          {installableWallets.map((wallet) => (
                            <WalletRow
                              key={wallet.name}
                              wallet={wallet}
                              onConnect={closeModal}
                            />
                          ))}
                        </Flex>
                      ),
                    },
                  ]}
                />
              )}
            </>
          )}
        </Modal>
      </AboutMovementConnect>
    </>
  );
}

interface WalletRowProps {
  wallet: AdapterWallet | AdapterNotDetectedWallet;
  onConnect?: () => void;
}

function WalletRow({ wallet, onConnect }: WalletRowProps) {
  return (
    <WalletItem wallet={wallet} onConnect={onConnect} asChild>
      <div className="wallet-menu-wrapper">
        <div className="wallet-name-wrapper">
          <WalletItem.Icon className="wallet-selector-icon" />
          <WalletItem.Name asChild>
            <Text className="wallet-selector-text">{wallet.name}</Text>
          </WalletItem.Name>
        </div>
        {isInstallRequired(wallet) ? (
          <WalletItem.InstallLink className="wallet-connect-install" />
        ) : (
          <WalletItem.ConnectButton asChild>
            <Button className="wallet-connect-button">Connect</Button>
          </WalletItem.ConnectButton>
        )}
      </div>
    </WalletItem>
  );
}

function MovementConnectWalletRow({ wallet, onConnect }: WalletRowProps) {
  return (
    <WalletItem wallet={wallet} onConnect={onConnect} asChild>
      <WalletItem.ConnectButton asChild>
        <Button size="large" className="movement-connect-button">
          <WalletItem.Icon className="wallet-selector-icon" />
          <WalletItem.Name />
        </Button>
      </WalletItem.ConnectButton>
    </WalletItem>
  );
}
