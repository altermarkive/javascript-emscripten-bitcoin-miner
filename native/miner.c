// JavaScript Emscripten Bitcoin Miner
//
// This is where real mining work gets done.
// The input parameters are hash1, data, midstate, target as given by bitcoin mining pool.
// For a standalone application they are passed as execution arguments,
// for alchemy version they are passed through exposed "start" function.
// In both cases the parameters are of string type.
// For alchemy version there is also a stop function available to interrupt mining
// (standalone application can be interrupted by SIGINT).
//
// This code is free software: you can redistribute it and/or modify it under
// the terms of the GNU Lesser General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version.
//
// This code is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for
// more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with code. If not, see <http://www.gnu.org/licenses/>.

#include <stdio.h>
#include <stdint.h>
#include <string.h>
#ifdef STANDALONE
#include <signal.h>
#endif

#define  bswap_16(value)                                           \
   ((((value) & 0xFF) << 8) | ((value) >> 8))

#define  bswap_32(value)                                           \
   (((uint32_t)bswap_16((uint16_t)((value) & 0xFFFF)) << 16) |     \
   (uint32_t)bswap_16((uint16_t)((value) >> 16)))

static inline void swap256(void* dest_p, const void* src_p){
  uint32_t* dest = (uint32_t*)dest_p;
  const uint32_t* src = (uint32_t*)src_p;

  dest[0] = src[7];
  dest[1] = src[6];
  dest[2] = src[5];
  dest[3] = src[4];
  dest[4] = src[3];
  dest[5] = src[2];
  dest[6] = src[1];
  dest[7] = src[0];
}

void bin2hex(const unsigned char* source, size_t length, unsigned char* target){
  unsigned int i;
  for(i = 0; i < length; i++){
    sprintf((char*)(target + (i * 2)), "%02x", (unsigned int)source[i]);
  }
  target[length * 2] = 0;
}

int hex2bin(unsigned char* p, const unsigned char* hexstr, unsigned int len){
  while(*hexstr && len){
    char hex_byte[3];
    unsigned int v;

    if(!hexstr[1]){
      printf("hex2bin str truncated\n");
      return 0;
    }

    hex_byte[0] = hexstr[0];
    hex_byte[1] = hexstr[1];
    hex_byte[2] = 0;

    if(sscanf(hex_byte, "%x", &v) != 1){
      printf("hex2bin sscanf '%s' failed\n", hex_byte);
      return 0;
    }

    *p = (unsigned char)v;

    p++;
    hexstr += 2;
    len--;
  }

  return((len == 0) ? 1 : 0);
}

int fulltest(const unsigned char* hash, const unsigned char* target){
  unsigned char hash_swap[32], target_swap[32];
  uint32_t* hash32 = (uint32_t*)hash_swap;
  uint32_t* target32 = (uint32_t*)target_swap;
  int i;
  int rc = 1;

  swap256(hash_swap, hash);
  swap256(target_swap, target);

  for(i = 0; i < 32 / 4; i++){
    uint32_t h32tmp = bswap_32(hash32[i]);
    uint32_t t32tmp = target32[i];

    target32[i] = bswap_32(target32[i]);

    if(h32tmp > t32tmp){
      rc = 0;
      break;
    }
    if(h32tmp < t32tmp){
      rc = 1;
      break;
    }
  }

  return(rc);
}

static inline uint32_t ror32(uint32_t word, unsigned int shift){
  return((word >> shift) | (word << (32 - shift)));
}

static inline uint32_t Ch(uint32_t x, uint32_t y, uint32_t z){
  return(z ^ (x & (y ^ z)));
}

static inline uint32_t Maj(uint32_t x, uint32_t y, uint32_t z){
  return((x & y) | (z & (x | y)));
}

#define e0(x)  (ror32(x, 2) ^ ror32(x,13) ^ ror32(x,22))
#define e1(x)  (ror32(x, 6) ^ ror32(x,11) ^ ror32(x,25))
#define s0(x)  (ror32(x, 7) ^ ror32(x,18) ^ (x >> 3))
#define s1(x)  (ror32(x,17) ^ ror32(x,19) ^ (x >> 10))

static inline void LOAD_OP(int I, uint32_t* W, const uint8_t* input){
  // Bitcoin uses big-endian so no swap needed
  W[I] = (((uint32_t*)(input))[I]);
}

static inline void BLEND_OP(int I, uint32_t* W){
  W[I] = s1(W[I-2]) + W[I-7] + s0(W[I-15]) + W[I-16];
}

static void sha256_transform(uint32_t* state, const uint8_t* input){
  uint32_t a, b, c, d, e, f, g, h, t1, t2;
  uint32_t W[64];
  int i;

  // Load the input
  for(i = 0; i < 16; i++){
    LOAD_OP(i, W, input);
  }

  // Blend
  for(i = 16; i < 64; i++){
    BLEND_OP(i, W);
  }

  // Load the state
  a = state[0];  b = state[1];  c = state[2];  d = state[3];
  e = state[4];  f = state[5];  g = state[6];  h = state[7];

  // Iterate
  t1 = h + e1(e) + Ch(e,f,g) + 0x428a2f98 + W[ 0];
  t2 = e0(a) + Maj(a,b,c);    d += t1;    h = t1 + t2;
  t1 = g + e1(d) + Ch(d,e,f) + 0x71374491 + W[ 1];
  t2 = e0(h) + Maj(h,a,b);    c += t1;    g = t1 + t2;
  t1 = f + e1(c) + Ch(c,d,e) + 0xb5c0fbcf + W[ 2];
  t2 = e0(g) + Maj(g,h,a);    b += t1;    f = t1 + t2;
  t1 = e + e1(b) + Ch(b,c,d) + 0xe9b5dba5 + W[ 3];
  t2 = e0(f) + Maj(f,g,h);    a += t1;    e = t1 + t2;
  t1 = d + e1(a) + Ch(a,b,c) + 0x3956c25b + W[ 4];
  t2 = e0(e) + Maj(e,f,g);    h += t1;    d = t1 + t2;
  t1 = c + e1(h) + Ch(h,a,b) + 0x59f111f1 + W[ 5];
  t2 = e0(d) + Maj(d,e,f);    g += t1;    c = t1 + t2;
  t1 = b + e1(g) + Ch(g,h,a) + 0x923f82a4 + W[ 6];
  t2 = e0(c) + Maj(c,d,e);    f += t1;    b = t1 + t2;
  t1 = a + e1(f) + Ch(f,g,h) + 0xab1c5ed5 + W[ 7];
  t2 = e0(b) + Maj(b,c,d);    e += t1;    a = t1 + t2;

  t1 = h + e1(e) + Ch(e,f,g) + 0xd807aa98 + W[ 8];
  t2 = e0(a) + Maj(a,b,c);    d += t1;    h = t1 + t2;
  t1 = g + e1(d) + Ch(d,e,f) + 0x12835b01 + W[ 9];
  t2 = e0(h) + Maj(h,a,b);    c += t1;    g = t1 + t2;
  t1 = f + e1(c) + Ch(c,d,e) + 0x243185be + W[10];
  t2 = e0(g) + Maj(g,h,a);    b += t1;    f = t1 + t2;
  t1 = e + e1(b) + Ch(b,c,d) + 0x550c7dc3 + W[11];
  t2 = e0(f) + Maj(f,g,h);    a += t1;    e = t1 + t2;
  t1 = d + e1(a) + Ch(a,b,c) + 0x72be5d74 + W[12];
  t2 = e0(e) + Maj(e,f,g);    h += t1;    d = t1 + t2;
  t1 = c + e1(h) + Ch(h,a,b) + 0x80deb1fe + W[13];
  t2 = e0(d) + Maj(d,e,f);    g += t1;    c = t1 + t2;
  t1 = b + e1(g) + Ch(g,h,a) + 0x9bdc06a7 + W[14];
  t2 = e0(c) + Maj(c,d,e);    f += t1;    b = t1 + t2;
  t1 = a + e1(f) + Ch(f,g,h) + 0xc19bf174 + W[15];
  t2 = e0(b) + Maj(b,c,d);    e += t1;    a = t1 + t2;

  t1 = h + e1(e) + Ch(e,f,g) + 0xe49b69c1 + W[16];
  t2 = e0(a) + Maj(a,b,c);    d += t1;    h = t1 + t2;
  t1 = g + e1(d) + Ch(d,e,f) + 0xefbe4786 + W[17];
  t2 = e0(h) + Maj(h,a,b);    c += t1;    g = t1 + t2;
  t1 = f + e1(c) + Ch(c,d,e) + 0x0fc19dc6 + W[18];
  t2 = e0(g) + Maj(g,h,a);    b += t1;    f = t1 + t2;
  t1 = e + e1(b) + Ch(b,c,d) + 0x240ca1cc + W[19];
  t2 = e0(f) + Maj(f,g,h);    a += t1;    e = t1 + t2;
  t1 = d + e1(a) + Ch(a,b,c) + 0x2de92c6f + W[20];
  t2 = e0(e) + Maj(e,f,g);    h += t1;    d = t1 + t2;
  t1 = c + e1(h) + Ch(h,a,b) + 0x4a7484aa + W[21];
  t2 = e0(d) + Maj(d,e,f);    g += t1;    c = t1 + t2;
  t1 = b + e1(g) + Ch(g,h,a) + 0x5cb0a9dc + W[22];
  t2 = e0(c) + Maj(c,d,e);    f += t1;    b = t1 + t2;
  t1 = a + e1(f) + Ch(f,g,h) + 0x76f988da + W[23];
  t2 = e0(b) + Maj(b,c,d);    e += t1;    a = t1 + t2;

  t1 = h + e1(e) + Ch(e,f,g) + 0x983e5152 + W[24];
  t2 = e0(a) + Maj(a,b,c);    d += t1;    h = t1 + t2;
  t1 = g + e1(d) + Ch(d,e,f) + 0xa831c66d + W[25];
  t2 = e0(h) + Maj(h,a,b);    c += t1;    g = t1 + t2;
  t1 = f + e1(c) + Ch(c,d,e) + 0xb00327c8 + W[26];
  t2 = e0(g) + Maj(g,h,a);    b += t1;    f = t1 + t2;
  t1 = e + e1(b) + Ch(b,c,d) + 0xbf597fc7 + W[27];
  t2 = e0(f) + Maj(f,g,h);    a += t1;    e = t1 + t2;
  t1 = d + e1(a) + Ch(a,b,c) + 0xc6e00bf3 + W[28];
  t2 = e0(e) + Maj(e,f,g);    h += t1;    d = t1 + t2;
  t1 = c + e1(h) + Ch(h,a,b) + 0xd5a79147 + W[29];
  t2 = e0(d) + Maj(d,e,f);    g += t1;    c = t1 + t2;
  t1 = b + e1(g) + Ch(g,h,a) + 0x06ca6351 + W[30];
  t2 = e0(c) + Maj(c,d,e);    f += t1;    b = t1 + t2;
  t1 = a + e1(f) + Ch(f,g,h) + 0x14292967 + W[31];
  t2 = e0(b) + Maj(b,c,d);    e += t1;    a = t1 + t2;

  t1 = h + e1(e) + Ch(e,f,g) + 0x27b70a85 + W[32];
  t2 = e0(a) + Maj(a,b,c);    d += t1;    h = t1 + t2;
  t1 = g + e1(d) + Ch(d,e,f) + 0x2e1b2138 + W[33];
  t2 = e0(h) + Maj(h,a,b);    c += t1;    g = t1 + t2;
  t1 = f + e1(c) + Ch(c,d,e) + 0x4d2c6dfc + W[34];
  t2 = e0(g) + Maj(g,h,a);    b += t1;    f = t1 + t2;
  t1 = e + e1(b) + Ch(b,c,d) + 0x53380d13 + W[35];
  t2 = e0(f) + Maj(f,g,h);    a += t1;    e = t1 + t2;
  t1 = d + e1(a) + Ch(a,b,c) + 0x650a7354 + W[36];
  t2 = e0(e) + Maj(e,f,g);    h += t1;    d = t1 + t2;
  t1 = c + e1(h) + Ch(h,a,b) + 0x766a0abb + W[37];
  t2 = e0(d) + Maj(d,e,f);    g += t1;    c = t1 + t2;
  t1 = b + e1(g) + Ch(g,h,a) + 0x81c2c92e + W[38];
  t2 = e0(c) + Maj(c,d,e);    f += t1;    b = t1 + t2;
  t1 = a + e1(f) + Ch(f,g,h) + 0x92722c85 + W[39];
  t2 = e0(b) + Maj(b,c,d);    e += t1;    a = t1 + t2;

  t1 = h + e1(e) + Ch(e,f,g) + 0xa2bfe8a1 + W[40];
  t2 = e0(a) + Maj(a,b,c);    d += t1;    h = t1 + t2;
  t1 = g + e1(d) + Ch(d,e,f) + 0xa81a664b + W[41];
  t2 = e0(h) + Maj(h,a,b);    c += t1;    g = t1 + t2;
  t1 = f + e1(c) + Ch(c,d,e) + 0xc24b8b70 + W[42];
  t2 = e0(g) + Maj(g,h,a);    b += t1;    f = t1 + t2;
  t1 = e + e1(b) + Ch(b,c,d) + 0xc76c51a3 + W[43];
  t2 = e0(f) + Maj(f,g,h);    a += t1;    e = t1 + t2;
  t1 = d + e1(a) + Ch(a,b,c) + 0xd192e819 + W[44];
  t2 = e0(e) + Maj(e,f,g);    h += t1;    d = t1 + t2;
  t1 = c + e1(h) + Ch(h,a,b) + 0xd6990624 + W[45];
  t2 = e0(d) + Maj(d,e,f);    g += t1;    c = t1 + t2;
  t1 = b + e1(g) + Ch(g,h,a) + 0xf40e3585 + W[46];
  t2 = e0(c) + Maj(c,d,e);    f += t1;    b = t1 + t2;
  t1 = a + e1(f) + Ch(f,g,h) + 0x106aa070 + W[47];
  t2 = e0(b) + Maj(b,c,d);    e += t1;    a = t1 + t2;

  t1 = h + e1(e) + Ch(e,f,g) + 0x19a4c116 + W[48];
  t2 = e0(a) + Maj(a,b,c);    d += t1;    h = t1 + t2;
  t1 = g + e1(d) + Ch(d,e,f) + 0x1e376c08 + W[49];
  t2 = e0(h) + Maj(h,a,b);    c += t1;    g = t1 + t2;
  t1 = f + e1(c) + Ch(c,d,e) + 0x2748774c + W[50];
  t2 = e0(g) + Maj(g,h,a);    b += t1;    f = t1 + t2;
  t1 = e + e1(b) + Ch(b,c,d) + 0x34b0bcb5 + W[51];
  t2 = e0(f) + Maj(f,g,h);    a += t1;    e = t1 + t2;
  t1 = d + e1(a) + Ch(a,b,c) + 0x391c0cb3 + W[52];
  t2 = e0(e) + Maj(e,f,g);    h += t1;    d = t1 + t2;
  t1 = c + e1(h) + Ch(h,a,b) + 0x4ed8aa4a + W[53];
  t2 = e0(d) + Maj(d,e,f);    g += t1;    c = t1 + t2;
  t1 = b + e1(g) + Ch(g,h,a) + 0x5b9cca4f + W[54];
  t2 = e0(c) + Maj(c,d,e);    f += t1;    b = t1 + t2;
  t1 = a + e1(f) + Ch(f,g,h) + 0x682e6ff3 + W[55];
  t2 = e0(b) + Maj(b,c,d);    e += t1;    a = t1 + t2;

  t1 = h + e1(e) + Ch(e,f,g) + 0x748f82ee + W[56];
  t2 = e0(a) + Maj(a,b,c);    d += t1;    h = t1 + t2;
  t1 = g + e1(d) + Ch(d,e,f) + 0x78a5636f + W[57];
  t2 = e0(h) + Maj(h,a,b);    c += t1;    g = t1 + t2;
  t1 = f + e1(c) + Ch(c,d,e) + 0x84c87814 + W[58];
  t2 = e0(g) + Maj(g,h,a);    b += t1;    f = t1 + t2;
  t1 = e + e1(b) + Ch(b,c,d) + 0x8cc70208 + W[59];
  t2 = e0(f) + Maj(f,g,h);    a += t1;    e = t1 + t2;
  t1 = d + e1(a) + Ch(a,b,c) + 0x90befffa + W[60];
  t2 = e0(e) + Maj(e,f,g);    h += t1;    d = t1 + t2;
  t1 = c + e1(h) + Ch(h,a,b) + 0xa4506ceb + W[61];
  t2 = e0(d) + Maj(d,e,f);    g += t1;    c = t1 + t2;
  t1 = b + e1(g) + Ch(g,h,a) + 0xbef9a3f7 + W[62];
  t2 = e0(c) + Maj(c,d,e);    f += t1;    b = t1 + t2;
  t1 = a + e1(f) + Ch(f,g,h) + 0xc67178f2 + W[63];
  t2 = e0(b) + Maj(b,c,d);    e += t1;    a = t1 + t2;

  state[0] += a; state[1] += b; state[2] += c; state[3] += d;
  state[4] += e; state[5] += f; state[6] += g; state[7] += h;
}

static void runhash(void* state, const void* input, const void* init){
  memcpy(state, init, 32);
  sha256_transform((uint32_t*)state, (uint8_t*)input);
}

const uint32_t sha256_init_state[8] = {
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
};

int scanhash(
  unsigned char* midstate,
  unsigned char* data,
  unsigned char* hash1,
  unsigned char* hash,
  unsigned char* target,
  uint32_t min_nonce,
  uint32_t max_nonce,
  uint32_t* last_nonce,
  volatile unsigned long* restart
){
  data += 64;
  uint32_t* hash32 = (uint32_t*)hash;
  uint32_t* nonce = (uint32_t*)(data + 12);
  uint32_t n = min_nonce;

  while(1){
    n++;
    *nonce = n;

    runhash(hash1, data, midstate);
    runhash(hash, hash1, sha256_init_state);

    if((hash32[7] == 0) && fulltest(hash, target)){
      *last_nonce = n;
      return(1);
    }

    if((n >= max_nonce) || *restart){
      *last_nonce = n;
      return(0);
    }
  }
}

volatile long unsigned int quit = 0;

#ifdef STANDALONE
void interrupt(int signal){
  quit = 1;
}
#endif

#ifdef STANDALONE
int main(int argc, char *argv[]){
  char proof_value[257];
  signal(SIGINT, interrupt);
  unsigned char* hash1String = (unsigned char*)argv[1];
  unsigned char* dataString = (unsigned char*)argv[2];
  unsigned char* targetString = (unsigned char*)argv[3];
  uint32_t minNonce = 0;
  uint32_t maxNonce = atol(argv[5]);
#else
int mine(char* hash1String, char* dataString, char* targetString, uint32_t minNonce, uint32_t maxNonce, char* proof){
#endif
  uint32_t nonce;
  unsigned char hash1[64];
  unsigned char data[128];
  unsigned char midstate[32];
  unsigned char target[32];
  hex2bin(hash1, (unsigned char*)hash1String, sizeof(hash1));
  hex2bin(data, (unsigned char*)dataString, sizeof(data));
  hex2bin(target, (unsigned char*)targetString, sizeof(target));
  memcpy(midstate, sha256_init_state, 32);
  sha256_transform((uint32_t*)midstate, data);

  unsigned char hash[32];
  memset(hash, 0, sizeof(hash));

  // Scan nonces for a proof-of-work hash
  int ok = scanhash(
    midstate, data,
    hash1, hash, target,
    minNonce, maxNonce, &nonce, &quit
  );

  // Report the result
  proof[0] = 0;
  proof[2 * sizeof(data)] = 0;
  if(ok){
    bin2hex(data, sizeof(data), (unsigned char*)proof);
  }

#ifdef STANDALONE
  printf("%s,%u\n", proof, nonce);
#endif
  return(nonce);
}
