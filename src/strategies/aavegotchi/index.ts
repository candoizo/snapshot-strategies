import { multicall } from '../../utils';

export const author = 'candoizo';
export const version = '0.1.1';

const tokenAbi = [
  'function balanceOf(address account) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function stakedInCurrentEpoch(address _account) view returns (tuple(address poolAddress, string poolName, string poolUrl, uint256 rate, uint256 amount)[] _staked)',
  'function staked(address _account) view returns (uint256 ghst_, uint256 poolTokens_, uint256 ghstUsdcPoolToken_)'
];

// AGIP37

// 1 power per token
const votingPowerSingleTokens = [
  '0x8Eb270e296023E9D92081fdF967dDd7878724424', // aPolGhst aka amghst
  '0x73958d46B7aA2bc94926d8a215Fa560A5CdCA3eA' // wapghst
];

// 1 power per ghst staked
const votingPowerGhstPools = [
  '0x8b1fd78ad67c7da09b682c5392b65ca7caa101b9', // ghst-quick
  '0x096c5ccb33cfc5732bcd1f3195c13dbefc4c82f4', // ghst-usdc
  '0xccb9d2100037f1253e6c1682adf7dc9944498aff', // ghst-weth,
  '0xf69e93771F11AECd8E554aA165C3Fe7fd811530c', // ghst-wmatic // is on sushiswa[]
  '0xfEC232CC6F0F3aEb2f81B2787A9bc9F6fc72EA5C', // ghst-fud
  '0x641CA8d96b01Db1E14a5fBa16bc1e5e508A45f2B', // ghst-fomo
  '0xC765ECA0Ad3fd27779d36d18E32552Bd7e26Fd7b', // ghst-alpha
  '0xBFad162775EBfB9988db3F24ef28CA6Bc2fB92f0', // ghst-kek
  '0x096C5CCb33cFc5732Bcd1f3195C13dBeFC4c82f4', // ghst-usdc
  '0xf69e93771F11AECd8E554aA165C3Fe7fd811530c', // ghst-matic
  '0xb0E35478a389dD20050D66a67FB761678af99678' // ghst-gltr
];

const singleTokenBalanceOfMulticallQuery = (token, addresses) =>
  addresses.map((addr) => [token, 'balanceOf', [addr]]).flat();

export async function strategy(
  _space,
  network,
  provider,
  addresses,
  options,
  snapshot
) {
  options.ghstQuickAddress =
    options.ghstQuickAddress || '0x8b1fd78ad67c7da09b682c5392b65ca7caa101b9';
  options.ghstUsdcAddress =
    options.ghstUsdcAddress || '0x096c5ccb33cfc5732bcd1f3195c13dbefc4c82f4';
  options.ghstWethAddress =
    options.ghstWethAddress || '0xccb9d2100037f1253e6c1682adf7dc9944498aff';
  options.ghstWmaticAddress =
    options.ghstWmaticAddress || '0xf69e93771F11AECd8E554aA165C3Fe7fd811530c';
  const ghst = options.tokenAddress;

  const lpPoolMulticallQuery = (tokens) =>
    tokens
      .map((token) => [
        [token, 'totalSupply', []],
        [ghst, 'balanceOf', [token]]
      ])
      .flat();

  const poolTokenMulticallQuery = (token, addresses) => [
    [token, 'totalSupply', []],
    [ghst, 'balanceOf', [token]],
    singleTokenBalanceOfMulticallQuery(token, addresses)
  ];

  const blockTag = typeof snapshot === 'number' ? snapshot : 'latest';
  const blockAfterStakingUpgrade = 22007789;
  const blockAfterAgip37 = 31471746;
  const afterStakingUpgrade =
    blockTag === 'latest' || blockAfterStakingUpgrade < blockTag;
  const afterAgip37 = blockTag === 'latest' || blockAfterAgip37 < blockTag;

  console.log(afterAgip37);
  if (afterAgip37) {
    // query gltr pools
    const singleTokenQueries = votingPowerSingleTokens.map((token) =>
      singleTokenBalanceOfMulticallQuery(token, addresses)
    );
    const poolQueries = votingPowerGhstPools.map((token) =>
      poolTokenMulticallQuery(token, addresses).flat()
    );
    // // console.log(singleTokenQueries);
    console.log(`oh`, singleTokenQueries, poolQueries);
    const res2 = await multicall(
      network,
      provider,
      tokenAbi,
      [
        ...lpPoolMulticallQuery(votingPowerGhstPools)
        // ...votingPowerSingleTokens
        // ...votingPowerGhstPools
      ],
      {
        blockTag
      }
    );
    console.log(res2);
  }

  const stakeFunctionName = afterStakingUpgrade
    ? 'stakedInCurrentEpoch'
    : 'staked';
  const stakeQuery = addresses.map((address) => [
    options.stakingAddress,
    stakeFunctionName,
    [address]
  ]);

  const res = await multicall(
    network,
    provider,
    tokenAbi,
    [
      [options.ghstQuickAddress, 'totalSupply', []],
      [options.tokenAddress, 'balanceOf', [options.ghstQuickAddress]],
      [options.ghstUsdcAddress, 'totalSupply', []],
      [options.tokenAddress, 'balanceOf', [options.ghstUsdcAddress]],
      [options.ghstWethAddress, 'totalSupply', []],
      [options.tokenAddress, 'balanceOf', [options.ghstWethAddress]],
      [options.ghstWmaticAddress, 'totalSupply', []],
      [options.tokenAddress, 'balanceOf', [options.ghstWmaticAddress]],
      ...stakeQuery
    ],
    { blockTag }
  );
  const tokensPerUni = (balanceInUni, totalSupply) => {
    return balanceInUni / 1e18 / (totalSupply / 1e18);
  };

  const [
    ghstQuickTotalSupply,
    ghstQuickTokenBalanceInUni,
    ghstUsdcTotalSupply,
    ghstUsdcTokenBalanceInUni,
    ghstWethTotalSupply,
    ghstWethTokenBalanceInUni,
    ghstWmaticTotalSupply,
    ghstWmaticTokenBalanceInUni
  ] = res;

  const ghstQuickTokensPerUni = tokensPerUni(
    ghstQuickTokenBalanceInUni,
    ghstQuickTotalSupply
  );

  const ghstUsdcTokensPerUni = tokensPerUni(
    ghstUsdcTokenBalanceInUni,
    ghstUsdcTotalSupply
  );
  const response = res.slice(8);
  let entries;
  if (afterStakingUpgrade) {
    const ghstWethTokensPerUni = tokensPerUni(
      ghstWethTokenBalanceInUni,
      ghstWethTotalSupply
    );
    const ghstWmaticTokensPerUni = tokensPerUni(
      ghstWmaticTokenBalanceInUni,
      ghstWmaticTotalSupply
    );
    entries = response.map((userStakeInfo, i) => {
      const votePowerAmounts = userStakeInfo._staked.map((info) => {
        if (
          info.poolAddress.toLowerCase() === options.tokenAddress.toLowerCase()
        ) {
          return Number(info.amount.toString()) / 1e18;
        }
        if (
          info.poolAddress.toLowerCase() ===
          options.ghstQuickAddress.toLowerCase()
        ) {
          return (
            (Number(info.amount.toString()) / 1e18) * ghstQuickTokensPerUni
          );
        }
        if (
          info.poolAddress.toLowerCase() ===
          options.ghstUsdcAddress.toLowerCase()
        ) {
          return (Number(info.amount.toString()) / 1e18) * ghstUsdcTokensPerUni;
        }
        if (
          info.poolAddress.toLowerCase() ===
          options.ghstWethAddress.toLowerCase()
        ) {
          return (Number(info.amount.toString()) / 1e18) * ghstWethTokensPerUni;
        }
        if (
          info.poolAddress.toLowerCase() ===
          options.ghstWmaticAddress.toLowerCase()
        ) {
          return (
            (Number(info.amount.toString()) / 1e18) * ghstWmaticTokensPerUni
          );
        }
        return 0;
      });
      return [addresses[i], votePowerAmounts.reduce((a, b) => a + b, 0)];
    });
  } else {
    // before staking upgrade old response
    entries = response.map((values, i) => [
      addresses[i],
      values[0] / 1e18 + //ghst_
        (values[1] / 10 ** options.decimals) * ghstQuickTokensPerUni + //poolTokens_
        (values[2] / 10 ** options.decimals) * ghstUsdcTokensPerUni //ghstUsdcPoolToken_
    ]);
  }
  return Object.fromEntries(entries);
}
