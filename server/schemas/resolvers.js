const { User, Issue } = require('../models');
const { signToken, AuthenticationError } = require('../utils/auth');
const stripeTK = require('stripe')('sk_test_51OpCgrBHDzDLC8eDir1qkE4VG8QC4pT9O71tXPuLPJuvp0PYbYeK6hd1CDZo1ajqjEUVzlW8p6sKHidPxuCEtqnY00Ge6ANeBY');

const resolvers = {
  Query: {
    me: async (parent, args, context) => {
      if (context.user) {
        const user = await User.findById(context.user._id).populate('savedIssues')

        return user;
      }

      throw AuthenticationError;
    },
    user: async (parent, { userId },) => {
      const user = await User.findById(userId).populate(['savedIssues'])

      return user;
    },
    users: async () => {
      return User.find().populate('savedIssues');
    },
    githubUser: async (parent,  githubUsername ) => {
      user = await User.findOne(githubUsername);

      return user;
    },
    issues: async (parent, args) => {

      return await Issue.find().populate(['voters', 'bounty']);

    },
    issue: async (parent, { issueId }) => {
      const issue = await Issue.findById(issueId).populate(['bounty'])

      return issue;

    },
    // bounties: async (parent, args) => {

    //   return await Bounty.find().populate('bountyIssuer');

    // },
    // bounty: async (parent, { bountyId }) => {
    //   const issue = await Bounty.findById(issueId).populate('bountyIssuer')

    //   return issue;

    // },
  },
  Mutation: {
    addUser: async (parent, args) => {
      const user = await User.create(args);
      const token = signToken(user);

      return { token, user };
    },
    login: async (parent, { email, password }) => {
      const user = await User.findOne({ email });

      if (!user) {
        throw AuthenticationError;
      }

      const correctPw = await user.isCorrectPassword(password);

      if (!correctPw) {
        throw AuthenticationError;
      }

      const token = signToken(user);

      return { token, user };
    },
    saveIssue: async (parent, issueData, context) => {
      if (context.user) {
        const issue = await Issue.create(issueData);

        await User.findByIdAndUpdate(
          { _id: context.user._id },
          { $addToSet: { savedIssues: issue._id } },
        );

        return issue;
      }
      throw AuthenticationError;
    },
    addGithubUsername: async (parent, { githubUsername }, context) => {
      if (context.user) {;
        const user = await User.findByIdAndUpdate(
          { _id: context.user._id },
          { $set: { githubUsername: githubUsername } },
          { new: true }
        );

        return user;
      }
      throw AuthenticationError;
    },
    removeIssue: async (parent, { issueId }, context) => {
      // console.log({ issueId })
      if (context.user) {
        return User.findOneAndUpdate(
          { _id: context.user._id },
          { $pull: { savedIssues: { issueId } } },
          { new: true }
        );
      }
      throw AuthenticationError;
    },
    addVote: async (parent, { issueId }, context) => {
      if (context.user) {
        return await Issue.findByIdAndUpdate(
          { _id: issueId },
          { $addToSet: { voters: context.user._id } },
          {
            new: true,
            runValidators: true,
          }
        );
      }
      throw AuthenticationError;
    },
    removeVote: async (parent, { issueId }, context) => {
      if (context.user) {
        return await Issue.findByIdAndUpdate(
          { _id: issueId },
          { $pull: { voters: context.user._id } },
          { new: true },
        );
      }
      throw AuthenticationError;
    },
    addBounty: async (parent, { issueId, bountyDollars }, context) => {
      console.log(bountyDollars)
      // const bountyDollars = Math.abs(bounty)
      if (context.user) {
        const issue = await Issue.findByIdAndUpdate(
          { _id: issueId },
          { $inc: { bounty: bountyDollars } },
          { new: true }
        );

        return issue;
      }
      throw AuthenticationError;
    },
    checkout: async (parent, { itemId, itemName, itemAmount }) => {
      const rootURL = 'http://localhost:3000'
      const session = await stripeTK.checkout.sessions.create
        ({
        payment_method_types: ['card'],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: itemAmount,
              product_data: {
                name: itemId,
                description: itemName
              }
            }
          }],
        mode: 'payment',
        success_url: `${rootURL}/success/{CHECKOUT_SESSION_ID}`,
        cancel_url: `${rootURL}/cancel`,
      });

      return { session: session.id }
    },
    decodeStripe: async (parent, { sessionId }) => {
      const session = await stripeTK.checkout.sessions.retrieve(sessionId);
      return { total: session.amount_total }
    },
  }
};

module.exports = resolvers;
