i have "https://www.npmjs.com/package/capacitor-biometric-authentication" from frontend part

in that package i have implemented

Capacitor Biometric Auth Plugin
A comprehensive biometric authentication plugin for Capacitor that provides secure, type-safe, and framework-independent biometric authentication across Android, iOS, and Web platforms.

Features
🔐 Multi-platform Support: Works on Android, iOS, and Web
📱 Multiple Biometric Types: Fingerprint, Face ID, Touch ID, and more
🌐 Web Authentication API: Modern WebAuthn implementation for browsers
🔒 Secure Session Management: Built-in session handling with configurable duration
🎨 Customizable UI: Configure colors, text, and appearance
🔧 Framework Independent: Use with any JavaScript framework
📝 Full TypeScript Support: Complete type definitions included
🔄 Fallback Options: Passcode, pattern, PIN alternatives

Platform-Specific Implementation
Android
Uses the BiometricPrompt API for secure authentication. Requires:

Android 6.0 (API 23) or higher
Biometric hardware (fingerprint sensor, face recognition)
iOS
Uses the LocalAuthentication framework. Supports:

Touch ID (iPhone 5s and later)
Face ID (iPhone X and later)
Requires iOS 11.0 or higher
Web
Implements the Web Authentication API (WebAuthn) for biometric authentication in browsers. Supports:

Platform authenticators (Windows Hello, Touch ID, etc.)
Requires HTTPS connection
Modern browsers with WebAuthn support

for web i am using "Web Authentication API", for android i'm using "androidx biometric api", for ios i'm using "localauthentication api"

now i need the backend part, mainly written in Typescript, that's why this package

i reference package we can look into is "https://www.npmjs.com/package/@simplewebauthn/server" with it's documentation at "https://simplewebauthn.dev/docs/packages/server"

i copy and pasted the page content as text in "simplewebauthn-server-documentation-part.md" file next to "Readme.md" file

that's just to reference

we need to create as simple and easy to implement implementation as possible, with providing as much control to end user through config, props, options as possible

it should be fully type safe and secure and follow all best practices

## 👨‍💻 Author

**Ahsan Mahmood**

- Website: [https://aoneahsan.com](https://aoneahsan.com)
- GitHub: [@aoneahsan](https://github.com/aoneahsan)
- Email: [aoneahsan@gmail.com](mailto:aoneahsan@gmail.com)

## Package info

i will put it's code on 

### General Rules

should be fully type safe, secure, fully freamework independant, should provide all the options (session validility, encryption secret and all other setting options) as configuration through plugin to end user, all the configuration options should be management when initailizing the plugin in code and no extra dificult config to get it to work, and should use the best practices and coding standards while coding th plugin
