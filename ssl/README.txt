Como gerar certificado SSL autoassinado para HTTPS local:

1. Instale o OpenSSL (se não tiver):
   - Baixe em https://slproweb.com/products/Win32OpenSSL.html
   - Ou use o terminal do Git Bash (vem com OpenSSL)

2. Abra o terminal na pasta do projeto:
   cd ssl

3. Rode o script:
   generate-ssl.bat

4. O certificado será gerado em:
   - ssl\server.key
   - ssl\server.crt

5. Rode o servidor normalmente:
   node server.js

6. Acesse https://localhost:3000

Se aparecer aviso de certificado, é normal (autoassinado).
