const Miner = require("./utils/miner");
const level = require("level");
const configure = require("./utils/configure");
const BN = require("bn.js");

//Get reference to database store
//const db = level("./ethML_server/model_store");

//Initialize miner
const miner = new Miner(process.argv[2]);

var isMining = false;

function startEventListener({ web3, ethML, ethMLAbi }) {
  ethML.events
    .ReceivedRequest({})
    .on("data", () => handleNewRequest({ web3, ethML, ethMLAbi }));
  ethML.events
    .NewBlock({})
    .on("data", () => handleNewBlock({ web3, ethML, ethMLAbi }));
}

function handleNewRequest({ web3, ethML, ethMLAbi }) {
  if (!isMining) {
    startMining({ web3, ethML, ethMLAbi });
  }
}

function handleNewBlock({ web3, ethML, ethMLAbi }) {
  if (isMining) {
    isMining = false;
    console.log("*--Now block formed--*");
    checkAndMine({ web3, ethML, ethMLAbi });
  }
}

async function checkAndMine({ web3, ethML, ethMLAbi }) {
  const canGetVars = await ethML.methods.canGetVariables().call();
  if (canGetVars) {
    startMining({ web3, ethML, ethMLAbi });
  }
}

async function getVariables({ ethML }) {
  const vars = await ethML.methods.getCurrentVariables().call();
  return {
    challenge: vars[0],
    id: vars[1],
    difficulty: vars[2],
    modelId: vars[3],
    dataPoint: vars[4],
  };
}

async function submitMiningSolution({
  web3,
  ethML,
  ethMLAbi,
  id,
  prediction,
  nonce,
}) {
  try {
    const tx = await web3.eth.sendTransaction({
      to: ethML.options.address,
      data: web3.eth.abi.encodeFunctionCall(ethMLAbi[1], [
        id,
        prediction,
        nonce,
      ]),
      gas: 2000000,
    });

    console.log("Successfully submitted mining solution for request id: ", id);
  } catch (err) {
    console.log(
      "Transaction failed (no panic): Block is already mined by 5 miners, or nonce submitted is invalid."
    );
  }
}

async function startMining({ web3, ethML, ethMLAbi }) {
  const { challenge, id, difficulty, modelId, dataPoint } = await getVariables({
    ethML,
  });

  isMining = true;

  console.log("*--Started Mining for--*");
  console.log("RequestId\tChallenge\tDifficulty");
  console.log("---------\t---------\t----------");
  console.log(`${id}\t${challenge}\t${difficulty}`);

  const nonce = await miner.findUnderTargetHash(
    web3,
    new BN(challenge.slice(2), 16),
    new BN(difficulty, 10)
  );

  console.log("Found POW solution: ", nonce);

  //Test
  const prediction = 356;

  await submitMiningSolution({ web3, ethML, ethMLAbi, id, prediction, nonce });
}

(async () => {
  const { web3, ethML, ethMLAbi } = await configure.init(process.argv[2]);
  startEventListener({ web3, ethML, ethMLAbi });
  checkAndMine({ web3, ethML, ethMLAbi });
})();
