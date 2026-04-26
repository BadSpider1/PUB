import socket
import struct
import curses
import threading
import os
import sys

ICMP_ECHO_REQUEST = 8


def checksum(data):
    s = 0
    for i in range(0, len(data), 2):
        if i + 1 < len(data):
            s += (data[i] << 8) + data[i + 1]
        else:
            s += (data[i] << 8)

    s = (s >> 16) + (s & 0xffff)
    s += (s >> 16)
    return ~s & 0xffff


def create_packet(message, packet_id):
    seq = 1
    header = struct.pack("bbHHh", ICMP_ECHO_REQUEST, 0, 0, packet_id, seq)
    data = message.encode()

    chksum = checksum(header + data)

    header = struct.pack(
        "bbHHh",
        ICMP_ECHO_REQUEST,
        0,
        socket.htons(chksum),
        packet_id,
        seq
    )

    return header + data


class ICMPChat:

    def __init__(self, peer):
        self.peer = peer
        self.sock = socket.socket(
            socket.AF_INET,
            socket.SOCK_RAW,
            socket.IPPROTO_ICMP
        )

        self.running = True
        self.messages = []
        self.packet_id = os.getpid() & 0xFFFF
        self.lock = threading.Lock()

    def send(self, msg):
        packet = create_packet(msg, self.packet_id)
        self.sock.sendto(packet, (self.peer, 1))

    def listen(self):
        while self.running:

            packet, addr = self.sock.recvfrom(65535)

            if addr[0] != self.peer:
                continue

            icmp_header = packet[20:28]
            icmp_type, code, chksum, packet_id, seq = struct.unpack(
                "bbHHh",
                icmp_header
            )

            if packet_id == self.packet_id:
                continue

            payload = packet[28:]

            try:
                msg = payload.replace(b"\x00", b"") \
                             .decode("utf-8", errors="ignore") \
                             .strip()

                if msg:
                    with self.lock:
                        self.messages.append((addr[0], msg))

            except:
                pass


def ui(stdscr, chat):

    curses.curs_set(1)

    height, width = stdscr.getmaxyx()

    chat_win = curses.newwin(height - 3, width, 0, 0)
    input_win = curses.newwin(3, width, height - 3, 0)

    input_win.nodelay(True)
    input_win.timeout(100)

    buffer = ""

    while chat.running:

        chat_win.clear()

        with chat.lock:
            start = max(0, len(chat.messages) - (height - 4))
            visible = chat.messages[start:]

        for i, (ip, msg) in enumerate(visible):

            line = f"<{ip}> {msg}"
            chat_win.addstr(i, 0, line[:width - 1])

        chat_win.refresh()

        input_win.clear()
        input_win.addstr(1, 1, "> " + buffer[:width - 4])
        input_win.refresh()

        key = input_win.getch()

        if key == -1:
            continue

        elif key == 10:  # ENTER

            if buffer.strip():

                chat.send(buffer)

                with chat.lock:
                    chat.messages.append(("me", buffer))

                buffer = ""

        elif key in (127, curses.KEY_BACKSPACE, 8):

            buffer = buffer[:-1]

        elif 32 <= key <= 126:

            buffer += chr(key)


def main(stdscr, peer):

    chat = ICMPChat(peer)

    listener = threading.Thread(
        target=chat.listen,
        daemon=True
    )

    listener.start()

    ui(stdscr, chat)


if __name__ == "__main__":

    if len(sys.argv) != 2:

        print("Usage:")
        print("sudo python3 icmpmessenger.py <peer_ip>")
        sys.exit(1)

    peer = sys.argv[1]

    curses.wrapper(main, peer)
