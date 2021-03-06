import cookie from 'cookie'
import Cookies from 'js-cookie'
import middleware from '../middleware'

middleware['i18n'] = async ({ app, req, res, route, store, redirect, isHMR }) => {
  if (isHMR) {
    return
  }

  // Options
  const lazy = <%= options.lazy %>
  const vuex = <%= JSON.stringify(options.vuex) %>
  const differentDomains = <%= options.differentDomains %>
  const isSpa = <%= options.isSpa %>

  // Helpers
  const LOCALE_CODE_KEY = '<%= options.LOCALE_CODE_KEY %>'
  const getLocaleCodes = <%= options.getLocaleCodes %>
  const getLocaleFromRoute = <%= options.getLocaleFromRoute %>
  const routesNameSeparator = '<%= options.routesNameSeparator %>'
  const defaultLocaleRouteNameSuffix = '<%= options.defaultLocaleRouteNameSuffix %>'
  const locales = getLocaleCodes(<%= JSON.stringify(options.locales) %>)
  const syncVuex = <%= options.syncVuex %>


  let locale = app.i18n.locale || app.i18n.defaultLocale || null

  // Handle root path redirect
  const rootRedirect = '<%= options.rootRedirect %>'
  if (route.path === '/' && rootRedirect) {
    redirect('/' + rootRedirect, route.query)
    return
  }

  // Handle browser language detection
  const detectBrowserLanguage = <%= JSON.stringify(options.detectBrowserLanguage) %>
  const routeLocale = getLocaleFromRoute(route, routesNameSeparator, defaultLocaleRouteNameSuffix, locales)

  const getCookie = () => {
    if (process.server && req && typeof req.headers.cookie !== 'undefined') {
      const cookies = req.headers && req.headers.cookie ? cookie.parse(req.headers.cookie) : {}
      return cookies[cookieKey]
    }

    return Cookies.get(cookieKey) || null
  }

  const setCookie = (locale) => {
    const date = new Date()
    if (!process.server || isSpa) {
      Cookies.set(cookieKey, locale, {
        expires: new Date(date.setDate(date.getDate() + 365)),
        path: '/'
      })
    } else if (res) {
      locale = routeLocale ? locale : Cookies.get(cookieKey) || locale
      const redirectCookie = cookie.serialize(cookieKey, locale, {
        expires: new Date(date.setDate(date.getDate() + 365)),
        path: '/'
      })
      res.setHeader('Set-Cookie', redirectCookie)
    }
  }

  const { useCookie, cookieKey, alwaysRedirect, fallbackLocale } = detectBrowserLanguage

  const switchLocale = async (newLocale) => {
    // Abort if different domains option enabled
    if (app.i18n.differentDomains) {
      return
    }

    // Abort if newLocale did not change
    if (newLocale === app.i18n.locale) {
      return
    }

    const oldLocale = app.i18n.locale
    app.i18n.beforeLanguageSwitch(oldLocale, newLocale)
    if(useCookie) {
      setCookie(newLocale)
    }
    // Lazy-loading enabled
    if (lazy) {
      const { loadLanguageAsync } = require('./utils')
      const messages = await loadLanguageAsync(app.i18n, newLocale)
      app.i18n.locale = newLocale
      app.i18n.onLanguageSwitched(oldLocale, newLocale)
      syncVuex(newLocale, messages)
    } else {
      // Lazy-loading disabled
      app.i18n.locale = newLocale
      app.i18n.onLanguageSwitched(oldLocale, newLocale)
      syncVuex(newLocale, app.i18n.getLocaleMessage(newLocale))
    }
  }

  if(routeLocale && locales.indexOf(routeLocale) !== -1) {
    if(routeLocale !== app.i18n.locale) {
      await switchLocale(routeLocale)
    } else {
      setCookie(routeLocale)
    }
  } else if(!routeLocale && !detectBrowserLanguage) {
    let routeName = route && route.name ? app.getRouteBaseName(route) : null
    let routePath = route ? route.fullPath : null
    let cookieLocale
    let redirectToLocale = fallbackLocale

    // Use cookieLocale if we support it, otherwise use fallbackLocale
    if(useCookie && (cookieLocale = getCookie()) && locales.indexOf(cookieLocale) !== -1) {
      redirectToLocale = cookieLocale
    }

    if(redirectToLocale && locales.indexOf(redirectToLocale) !== -1) {

      // We switch the locale before redirect to prevent loops
      await switchLocale(redirectToLocale)

      if(routeName) {
        // Get path using routeName, if we've found it
        routePath = app.localePath(Object.assign({}, route , {
          name: routeName
        }), redirectToLocale)
      } else if (!routeName && routePath && routePath !== '/') {
        // Or create a new path adding locale at the start of the route full path: /{locale}/full/path/to/route
        routePath = `/${redirectToLocale}${routePath}`;
      } else {
        // Otherwise get fallback route using routeName "index"
        routePath = app.localePath(Object.assign({}, route , {
          name: 'index'
        }), redirectToLocale)
      }

      redirect(routePath)
    }
  }

  if (detectBrowserLanguage) {
    let browserLocale

    if (useCookie && (browserLocale = getCookie()) && browserLocale !== 1 && browserLocale !== '1') {
      // Get preferred language from cookie if present and enabled
      // Exclude 1 for backwards compatibility and fallback when fallbackLocale is empty
    } else if (!process.server || isSpa && typeof navigator !== 'undefined') {
      // Get browser language either from navigator if running in mode SPA, or from the headers
      if (navigator.languages && navigator.languages.length) {
        // latest versions of Chrome and Firefox set this correctly
        browserLocale = navigator.languages[0]
      } else if (navigator.userLanguage) {
        // IE only
        browserLocale = navigator.userLanguage
      } else {
        // latest versions of Chrome, Firefox, and Safari set this correctly
        browserLocale = navigator.language
      }
    } else if (req && typeof req.headers['accept-language'] !== 'undefined') {
      browserLocale = req.headers['accept-language'].split(',')[0]
    }

    if (browserLocale) {
      if (!routeLocale) {
        let routeName = route && route.name ? app.getRouteBaseName(route) : null
        let routePath = route ? route.fullPath : null
        let cookieLocale
        let redirectToLocale = fallbackLocale

        // Use browserLocale if we support it, otherwise use fallbackLocale
        if(locales.indexOf(browserLocale) !== -1) {
          redirectToLocale = browserLocale
        }

        // Use cookieLocale if we support it, otherwise use browserLocale
        if(useCookie && (cookieLocale = getCookie()) && locales.indexOf(cookieLocale) !== -1) {
          redirectToLocale = cookieLocale
        }

        if (redirectToLocale && locales.indexOf(redirectToLocale) !== -1) {

          // We switch the locale before redirect to prevent loops
          await switchLocale(redirectToLocale)

          if(routeName) {
            // Get path using routeName, if we've found it
            routePath = app.localePath(Object.assign({}, route , {
              name: routeName
            }), redirectToLocale)
          } else if (!routeName && routePath && routePath !== '/') {
            // Or create a new path adding locale at the start of the route full path: /{locale}/full/path/to/route
            routePath = `/${redirectToLocale}${routePath}`;
          } else {
            // Otherwise get fallback route using routeName "index"
            routePath = app.localePath(Object.assign({}, route , {
              name: 'index'
            }), redirectToLocale)
          }

          redirect(routePath)

          return
        }
      } else if(!useCookie || alwaysRedirect || !getCookie()) {
        let routeName = route && route.name ? app.getRouteBaseName(route) : null
        let routePath = route ? route.fullPath : null
        let redirectToLocale = fallbackLocale

        // Use browserLocale if we support it, otherwise use fallbackLocale
        if(locales.indexOf(browserLocale) !== -1) {
          redirectToLocale = browserLocale
        }

        if (redirectToLocale && redirectToLocale !== app.i18n.locale && locales.indexOf(redirectToLocale) !== -1) {

          // We switch the locale before redirect to prevent loops
          await switchLocale(redirectToLocale)

          if(routeName) {
            // Get path using routeName, if we've found it
            routePath = app.localePath(Object.assign({}, route , {
              name: routeName
            }), redirectToLocale)
          } else if (!routeName && routePath && routePath !== '/') {
            // Or create a new path adding locale at the start of the route full path: /{locale}/full/path/to/route
            routePath = `/${redirectToLocale}${routePath}`;
          } else {
            // Otherwise get fallback route using routeName "index"
            routePath = app.localePath(Object.assign({}, route , {
              name: 'index'
            }), redirectToLocale)
          }

          redirect(routePath)

          return
        }
      }
    }
  }

  await switchLocale(routeLocale ? routeLocale : locale)
}
