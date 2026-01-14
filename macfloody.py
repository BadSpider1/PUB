import time
import secrets
from scapy.all import Ether, sendp, Raw, conf

conf.use_pcap = True

IFACE = "Ethernet"

OUI_PREFIX = "de:ad:be"

def random_mac() -> str:
    host = secrets.token_bytes(3)
    return f"{OUI_PREFIX}:{host[0]:02x}:{host[1]:02x}:{host[2]:02x}"

def send_mac(mac: str):
    frame = Ether(src=mac, dst="ff:ff:ff:ff:ff:ff") / Raw(load=b"classroom demo")
    sendp(frame, iface=IFACE, verbose=False)

def main():
    total = 16000 
    delay = 0.2

    for i in range(total):
        mac = random_mac()
        print(f"[{i+1}/{total}] Sending frame with source {mac}")
        send_mac(mac)
        time.sleep(delay)

    print("Done.")

if __name__ == "__main__":
    main()
