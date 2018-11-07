import { Injectable } from '@angular/core';
import { HttpRequest, HttpResponse, HttpHandler, HttpEvent, HttpInterceptor, HTTP_INTERCEPTORS } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay, mergeMap, materialize, dematerialize } from 'rxjs/operators';

@Injectable()
export class FakeBackendInterceptor implements HttpInterceptor {

    constructor() { }

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        // Un array dans le local storage qui stock les utilisateurs
        let users: any[] = JSON.parse(localStorage.getItem('users')) || [];

        // simule un appel à l'api server
        return of(null).pipe(mergeMap(() => {

            // authentication
            if (request.url.endsWith('/users/authenticate') && request.method === 'POST') {
                // cherche un match pour le login
                let filteredUsers = users.filter(user => {
                    return user.username === request.body.username && user.password === request.body.password;
                });

                if (filteredUsers.length) {
                    // Si login valide retourne un code 200 avec les détails utilisateur et un jwt
                    let user = filteredUsers[0];
                    let body = {
                        id: user.id,
                        username: user.username,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        token: 'fake-jwt-token'
                    };

                    return of(new HttpResponse({ status: 200, body: body }));
                } else {
                    // Erreur 400 si invalide
                    return throwError({ error: { message: 'Username or password is incorrect' } });
                }
            }

            // get utilisateurs
            if (request.url.endsWith('/users') && request.method === 'GET') {
                // cherche le faux token dans le header afin de récupérer les infos utilisateurs
                if (request.headers.get('Authorization') === 'Bearer fake-jwt-token') {
                    return of(new HttpResponse({ status: 200, body: users }));
                } else {
                    // return 401 not authorised if token is null or invalid
                    return throwError({ status: 401, error: { message: 'Unauthorised' } });
                }
            }

            // get user by id
            if (request.url.match(/\/users\/\d+$/) && request.method === 'GET') {
                // check for fake auth token in header and return user if valid, this security is implemented server side in a real application
                if (request.headers.get('Authorization') === 'Bearer fake-jwt-token') {
                    // find user by id in users array
                    let urlParts = request.url.split('/');
                    let id = parseInt(urlParts[urlParts.length - 1]);
                    let matchedUsers = users.filter(user => { return user.id === id; });
                    let user = matchedUsers.length ? matchedUsers[0] : null;

                    return of(new HttpResponse({ status: 200, body: user }));
                } else {
                    // return erreur 401 en cas de login invalide ou de mauvais token
                    return throwError({ status: 401, error: { message: 'Unauthorised' } });
                }
            }

            // register user
            if (request.url.endsWith('/users/register') && request.method === 'POST') {
                // get un nouvel objet utilisateur depuis le post body
                let newUser = request.body;

                // validation
                let duplicateUser = users.filter(user => { return user.username === newUser.username; }).length;
                if (duplicateUser) {
                    return throwError({ error: { message: 'Username "' + newUser.username + '" is already taken' } });
                }

                // enregistre un nouvel utilisateur
                newUser.id = users.length + 1;
                users.push(newUser);
                localStorage.setItem('users', JSON.stringify(users));

                // reponse 200 si OK
                return of(new HttpResponse({ status: 200 }));
            }

            // delete user
            if (request.url.match(/\/users\/\d+$/) && request.method === 'DELETE') {
                // cherche si l'utilisateur est valide grâce au token du header
                if (request.headers.get('Authorization') === 'Bearer fake-jwt-token') {
                    // cherche l'utilisateur grâce à son id dans l'array des utilisateurs
                    let urlParts = request.url.split('/');
                    let id = parseInt(urlParts[urlParts.length - 1]);
                    for (let i = 0; i < users.length; i++) {
                        let user = users[i];
                        if (user.id === id) {
                            // delete user
                            users.splice(i, 1);
                            localStorage.setItem('users', JSON.stringify(users));
                            break;
                        }
                    }

                    // reponse 200 OK
                    return of(new HttpResponse({ status: 200 }));
                } else {
                    // return 401 not authorised si token non valide
                    return throwError({ status: 401, error: { message: 'Unauthorised' } });
                }
            }

            // pour les requêtes non prises en compte au dessus
            return next.handle(request);
            
        }))

        
        .pipe(materialize())
        .pipe(delay(500))
        .pipe(dematerialize());
    }
}

export let fakeBackendProvider = {
    // utilise un faux back-end plutôt que des requêtes http
    provide: HTTP_INTERCEPTORS,
    useClass: FakeBackendInterceptor,
    multi: true
};