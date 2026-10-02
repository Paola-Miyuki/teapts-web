import { Injectable, OnModuleInit } from '@nestjs/common';
import Supertokens from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';
import { AccountsService } from '../accounts/accounts.service';

@Injectable()
export class SupertokensService implements OnModuleInit {
  constructor(private readonly accountsService: AccountsService) {}

  onModuleInit() {
    Supertokens.init({
      framework: 'express',
      supertokens: {
        connectionURI: process.env.SUPERTOKENS_CONNECTION_URI || 'https://try.supertokens.com',
      },
      appInfo: {
        appName: 'Teapts',
        apiDomain: process.env.API_DOMAIN || 'http://localhost:3000',
        websiteDomain: process.env.WEBSITE_DOMAIN || 'http://localhost:3000',
        apiBasePath: '/auth',
        websiteBasePath: '/auth',
      },
      recipeList: [
        EmailPassword.init({
          signUpFeature: {
            formFields: [
              {
                id: 'name',
                validate: async (value) => {
                  if (typeof value !== 'string' || value.trim().length === 0) {
                    return 'Nome é obrigatório';
                  }
                  return undefined;
                },
              },
            ],
          },
          override: {
            apis: (originalImplementation) => {
              return {
                ...originalImplementation,
                signUpPOST: async (input) => {
                  if (originalImplementation.signUpPOST === undefined) {
                    throw new Error('signUpPOST indefinido');
                  }

                  const response = await originalImplementation.signUpPOST(input);

                  if (response.status === 'OK') {
                    const supertokensUserId = response.user.id;
                    const nameField = input.formFields.find((f) => f.id === 'name');
                    const emailField = input.formFields.find((f) => f.id === 'email');

                    const name = nameField ? String(nameField.value) : '';
                    const email = emailField ? String(emailField.value) : response.user.emails[0];

                    try {
                      await this.accountsService.createAccount({
                        supertokensUserId,
                        email,
                        name,
                      });
                    } catch (error) {
                      await Supertokens.deleteUser(supertokensUserId);

                      const errMessage = (error as Error).message;

                      if (errMessage === 'EMAIL_ALREADY_EXISTS') {
                        return {
                          status: 'GENERAL_ERROR',
                          message: 'Este e-mail já está cadastrado no sistema.',
                        };
                      }

                      return {
                        status: 'GENERAL_ERROR',
                        message: 'Erro interno ao criar conta local.',
                      };
                    }
                  }

                  return response;
                },
              };
            },
          },
        }),
        Session.init(),
      ],
    });
  }
}