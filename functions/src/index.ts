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
    console.log({address, signature});

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

    console.log({decodedAddress});

    if (decodedAddress !== address) {
      res.status(400).json({error: "Invalid signature"});
      return;
    }

    const assets = await _getAssets(address);

    if (!assets || !assets.length) {
      res.status(200).json([]);
    }

    const tokenIds = assets.map((asset: any) => Number(asset["token_id"]));
    console.log({tokenIds});

    const videosData = await db.collection("videos")
        .where("tokenId", "in", tokenIds)
        .get();

    if (!videosData.empty) {
      const videos = videosData.docs.map((doc: any) => doc.data());
      console.log({videos});
      videos.forEach((video: any) => {
        const asset = assets
            .find((asset: any) =>
              Number(asset["token_id"]) === Number(video.tokenId));
        if (asset) {
          asset.video = video.link;
        }
      });
    }

    res.status(200).json(assets);
  });
});

// eslint-disable-next-line require-jsdoc
async function _getAssets(address: string): Promise<any[]> {
  const contractAddress = "0xca9eE3460D84Eac6C2F2284CFe3E3B35A2267d78";
  const resp = await axios.get(
      `https://api.opensea.io/api/v1/assets?owner=${address}&asset_contract_address=${contractAddress}`,
      {
        headers: {
          "x-api-key": "847dbb3dc2ec45c895795c69015f6fc3",
        },
      }
  );

  console.log({resp});

  const {assets} = resp.data;

  return assets;
}
