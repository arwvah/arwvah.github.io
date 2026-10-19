# DEADFACE 2026 — Uninvited Guest: NTLMv2 NTProofStr

## Answer

`deadface{5a2342014fe7f28997ce4dcd09f6b7f8}`

## Evidence

Artifact: `/home/arwah/Downloads/demonne.pcap`  
SHA-256: `a717623237abefb2fc061d6df8f6e9d1391f066f5ac448042b5eb72d41a8ddb3`

The poisoned-name sequence was an LLMNR response in frame 1463: it resolved
`dmf-field-01` to `10.77.10.66`. Immediately afterwards, Nathan's workstation
(MAC `52:54:00:77:20:01`) opened an SMB session to the rogue host. The first
NTLMv2 authentication in that sequence was frame 1489. Wireshark decodes its
username as `nkessler` and exposes the 16-byte proof in the
`ntlmssp.ntlmv2_response.ntproofstr` field.

## Reproduction

Locate the poisoned LLMNR reply first:

```bash
tshark -r /home/arwah/Downloads/demonne.pcap \
  -Y 'frame.number == 1463' \
  -T fields -e frame.number -e llmnr.name -e dns.a
```

Then inspect the first following NTLMv2 authentication:

```bash
tshark -r /home/arwah/Downloads/demonne.pcap \
  -Y 'frame.number == 1489' \
  -T fields \
  -e frame.number -e frame.time_utc \
  -e eth.src -e eth.dst \
  -e ntlmssp.auth.username \
  -e ntlmssp.ntlmv2_response.ntproofstr
```

The final field is `5a2342014fe7f28997ce4dcd09f6b7f8`; it is already a 16-byte
value written as 32 hexadecimal characters, so it can be placed directly in
the requested flag format.
