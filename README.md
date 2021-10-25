# neonz-rankings
Tezos NEONZ PFP NFT rarity scoring and rankings calculator

# How to Run

Assuming you have Node v14 installed and selected perform the following:

1) `yarn install`
2) `yarn start`

This will pull down the NEONZ data, process it, and store rankings and scores to `neonz-by-id.csv` and `neonz-by-rank.csv`. Also, all will be output to `neonz.json` which is a file that is used on the NEONZ Gallery (https://neonz.gallery) and the TezTools UI (https://dev.teztools.io/account/integro.tez see: NFTs > NEONZ).

It will also cache JSON of the IPFS metadata for each token in `ipfs_cache/`.
