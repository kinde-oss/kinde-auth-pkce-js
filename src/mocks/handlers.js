import {rest} from 'msw';

export const handlers = [
  rest.get(
    'https://sdk.kinde.localtest.me/oauth2/user_profile',
    (req, res, ctx) => {
      return res(
        ctx.json({
          id: 'kp:af23c91f1ab9441b96f7d358580a366c',
          last_name: null,
          first_name: 'EssDee Kay',
          preferred_email: 'peterphanouvong0+sdk@gmail.com'
        })
      );
    }
  ),

  rest.post('https://sdk.kinde.localtest.me/oauth2/token', (req, res, ctx) => {
    return res(ctx.json({access_token: 'testToken'}));
  })
];
