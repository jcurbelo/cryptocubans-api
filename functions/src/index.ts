import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {User} from "./user.interface";
import {ethers} from "ethers";
import axios from "axios";
import * as cors from "cors";
const corsHandler = cors({origin: true});

admin.initializeApp();

export const auth = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    const db = admin.firestore();
    const {address} = req.query;

    const data = await db.collection("users")
        .where("address", "==", address)
        .get();

    const user: User = {address: address as string};

    if (data.empty) {
      user.id = (await db.collection("users").add(user)).id;
    } else {
      user.id = data.docs[0].id;
    }
    user.nonce = Math.floor(Math.random() * 10000000);
    await db.collection("users")
        .doc(user.id as string)
        .update({nonce: user.nonce});

    res.status(200).json(user);
  });
});


export const verify = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    const db = admin.firestore();
    const {address, signature} = req.query;

    const data = await db.collection("users")
        .where("address", "==", address)
        .get();

    if (data.empty) {
      res.status(400).json({error: "User not found"});
      return;
    }

    const user = data.docs[0].data() as User;

    const decodedAddress = ethers.utils
        .verifyMessage(user.nonce?.toString() || "", signature as string);

    if (decodedAddress !== address) {
      res.status(400).json({error: "Invalid signature"});
      return;
    }

    const tokenIds = await _getTokens(address);

    const videosData = await db.collection("videos")
        .where("tokenId", "in", tokenIds)
        .get();

    if (!videosData.empty) {
      const links = videosData.docs.map((doc) => doc.data()["link"] as string);
      res.status(200).json(links);
    }

    res.status(200).json([]);
  });
});

// eslint-disable-next-line require-jsdoc
async function _getTokens(address: string): Promise<number[]> {
  let results: number[] = [];
  const contractAddress = "0xca9eE3460D84Eac6C2F2284CFe3E3B35A2267d78";
  const resp = await axios.get(
      `https://api.opensea.io/api/v1/assets?owner=${address}&asset_contract_address=${contractAddress}`,
      {
        headers: {
          "x-api-key": "847dbb3dc2ec45c895795c69015f6fc3",
        },
      }
  );

  const {assets} = resp.data;

  if (assets && assets.length > 0) {
    results = assets.map((asset: any) => Number(asset["token_id"]));
  }

  return results;
}
